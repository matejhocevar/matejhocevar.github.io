import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { FilmPass } from "three/addons/postprocessing/FilmPass.js";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import { printDeveloperMessage, isMobile } from "./main.js";

const canvasElement = document.querySelector("#canvas");

const isDebug = false;

class Render3dModel {
  model;
  scene;
  camera;
  controls;
  controller = {
    focus: 1.5,
    aperture: 55,
    maxblur: 0.01,
    filmIntensity: 0.1,
    rotationSpeed: this._DEFAULT_ROTATION_SPEED,
    modelPositionX: 0,
    modelPositionY: 0,
    modelPositionZ: 0,
    modelRotationX: 0,
    modelRotationY: 0,
    modelRotationZ: 0,
  };

  _debug;
  _renderer;
  _gui;
  _loader;
  _composer;

  // Properties
  _DEFAULT_ROTATION_SPEED = 0.0025;
  _DEFAULT_ZOOM = 0.0025;
  _RESET_ROTATION_AFTER_MS = 10;

  // Post-processing
  _bokehPass;
  _filmPass;
  _chromaticAberrationPass;

  constructor({ debug = false }) {
    this._debug = debug;

    this._setupGui();
    this._setupRenderer();
    this._setupScene();
    this._setupCamera();
    this._setupControls();
    this._setupLights();
    this._setupLoader();
    this._setupPostProcessing();

    this._loadModel();

    this._render();
  }

  _setupRenderer = () => {
    this._renderer = new THREE.WebGLRenderer({
      canvas: canvasElement,
    });
    this._renderer.setSize(window.innerWidth, window.innerHeight);
  };

  _setupCamera = () => {
    this.camera = new THREE.PerspectiveCamera(75, innerWidth / window.innerHeight, 0.1, 10000);
    if (this._debug) {
      const controlsFolder = this._gui.addFolder("Camera");
      controlsFolder.add(this.controller, "modelPositionX", -10, 10, 0.1).onChange(this._applyParameters);
      controlsFolder.add(this.controller, "modelPositionY", -10, 10, 0.1).onChange(this._applyParameters);
      controlsFolder.add(this.controller, "modelPositionZ", -10, 10, 0.1).onChange(this._applyParameters);
      controlsFolder.add(this.controller, "modelRotationX", -10, 10, 0.1).onChange(this._applyParameters);
      controlsFolder.add(this.controller, "modelRotationY", -10, 10, 0.1).onChange(this._applyParameters);
      controlsFolder.add(this.controller, "modelRotationZ", -10, 10, 0.1).onChange(this._applyParameters);
    }
  };

  _setupControls = () => {
    this.controls = new OrbitControls(this.camera, canvasElement);
    this.controls.update();
  };

  _setupLights = () => {
    const directionalLight = new THREE.DirectionalLight(0xffffff);
    directionalLight.position.set(1, 1, 1);
    this.scene.add(directionalLight);

    if (this._debug) {
      const directionalLightHelper = new THREE.DirectionalLightHelper(directionalLight, 5, 0xff0000);
      this.scene.add(directionalLightHelper);
    }

    const ambientLight = new THREE.AmbientLight(0xffffff);
    this.scene.add(ambientLight);
  };

  _setupScene = () => {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x182030);
  };

  _setupLoader = () => {
    this._loader = new GLTFLoader();
    this._loader.setCrossOrigin("anonymous");

    if (this._debug) {
      this._addAxesHelper();
    }
  };

  _setupGui = () => {
    this._gui = new GUI();
    this._gui.hide();

    if (this._debug) {
      this._gui.show();
    }
  };

  _setupPostProcessing = () => {
    this._composer = new EffectComposer(this._renderer);

    // Create a render pass to render the scene
    const renderPass = new RenderPass(this.scene, this.camera);
    this._composer.addPass(renderPass);

    // Bokeh pass
    this._bokehPass = new BokehPass(this.scene, this.camera, {
      focus: this.controller.focus,
      aperture: this.controller.aperture,
      maxblur: this.controller.maxblur,
      width: innerWidth,
      height: innerHeight,
    });
    this._bokehPass.renderToScreen = true;
    this._composer.addPass(this._bokehPass);

    // Film pass
    this._filmPass = new FilmPass(0.1);
    this._composer.addPass(this._filmPass);

    // Chromatic aberration pass
    let chromaticAberrationShader = {
      uniforms: {
        tDiffuse: {
          value: null,
        },
        uChromaFactor: { value: 0.025 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;

        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
                      uniform sampler2D tDiffuse;
                      uniform float uChromaFactor;
                      varying vec2 vUv;

                      void main() {
                          vec2 uv = vUv;
                          vec2 dist = uv.xy - 0.5;
                          vec2 offset = uChromaFactor * dist * length(dist);
                          vec3 col;
                          col.r = texture2D(tDiffuse, uv - offset).r;
                          col.g = texture2D(tDiffuse, uv).g;
                          col.b = texture2D(tDiffuse, uv + offset).b;
                          gl_FragColor = vec4(col, 1.0);
                      }
                  `,
    };

    this._chromaticAberrationPass = new ShaderPass(chromaticAberrationShader);
    this._composer.addPass(this._chromaticAberrationPass);

    this._applyParameters();

    if (this._debug) {
      const postProcessingFolder = this._gui.addFolder("Post-processing");
      postProcessingFolder.add(this.controller, "focus", 0.01, 90.0, 0.5).onChange(this._applyParameters);
      postProcessingFolder.add(this.controller, "aperture", 0, 100, 1).onChange(this._applyParameters);
      postProcessingFolder.add(this.controller, "maxblur", 0.0, 0.01, 0.001).onChange(this._applyParameters);
      postProcessingFolder.add(this.controller, "filmIntensity", 0.0, 1, 0.01).onChange(this._applyParameters);
    }
  };

  _loadModel = () => {
    this._loader.load(
      "assets/scene.gltf",
      (gltf) => {
        this.model = gltf.scene;

        this._setInitialModelPosition();

        this.scene.add(this.model);

        this.startRotation();
        this._animateInitialZoomIn();
      },
      (_) => {
        printDeveloperMessage();
      },
      (error) => {
        console.error(error);
      }
    );
  };

  _render = () => {
    if (this.model) {
      this.model.rotation.z += this.controller.rotationSpeed;
    }
    this._composer.render();

    requestAnimationFrame(this._render);
  };

  // Public

  startRotation = () => (this.controller.rotationSpeed = this._DEFAULT_ROTATION_SPEED);

  stopRotation = (autoResume = true) => {
    this.controller.rotationSpeed = 0;

    if (autoResume) {
      setTimeout(() => {
        const direction = Math.random() < 0.5 ? -1 : 1;
        this.controller.rotationSpeed = this._DEFAULT_ROTATION_SPEED * direction;
      }, this._RESET_ROTATION_AFTER_MS);
    }
  };

  zoomTo = (target) => {
    this.stopRotation();

    let model = {
      position: {
        x: 0,
        y: 0,
        z: 0,
      },
      rotation: {
        x: 0,
        y: 0,
        z: 0,
      },
    };

    switch (target) {
      case "start": {
        model.position.x = -1.5;
        model.position.y = 0;
        model.position.z = 0;

        if (isMobile) {
          model.position.x = 0.5;
          model.position.y = -1.05;
          model.position.z = 0;
        }

        model.rotation.x = 4;
        model.rotation.y = 0;
        model.rotation.z = 0;
        break;
      }
      case "laptopBack": {
        model.position.x = -0.2;
        model.position.y = -0.6;
        model.position.z = 2;

        model.rotation.x = 4;
        model.rotation.y = 0;
        model.rotation.z = -0.1;

        if (isMobile) {
          model.position.x = 0.2;
          model.position.y = -1.4;
          model.position.z = 1.4;

          model.rotation.x = 3.8;
          model.rotation.y = 0;
          model.rotation.z = -0.1;
        }

        break;
      }
      case "keyboard": {
        model.position.x = -0.2;
        model.position.y = -0.4;
        model.position.z = 1.7;

        model.rotation.x = 3.3;
        model.rotation.y = 3.4;
        model.rotation.z = 0;

        if (isMobile) {
          model.position.x = 0.4;
          model.position.y = -1;
          model.position.z = 0.8;

          model.rotation.x = 3;
          model.rotation.y = -2.7;
          model.rotation.z = 0;
        }

        break;
      }
      case "face": {
        model.position.x = -0.6;
        model.position.y = -0.4;
        model.position.z = 2;

        model.rotation.x = 4;
        model.rotation.y = 1;
        model.rotation.z = -0.7;

        if (isMobile) {
          model.position.x = 0.1;
          model.position.y = -1.3;
          model.position.z = 0.3;

          model.rotation.x = 4;
          model.rotation.y = 1.3;
          model.rotation.z = -1.3;
        }

        break;
      }
      case "numbers": {
        model.position.x = -2.1;
        model.position.y = 1;
        model.position.z = -2.4;

        model.rotation.x = 0;
        model.rotation.y = 0;
        model.rotation.z = 0;

        if (isMobile) {
          model.position.x = 0.9;
          model.position.y = 0.9;
          model.position.z = -1.8;

          model.rotation.x = 6.8;
          model.rotation.y = 0.2;
          model.rotation.z = 0;
        }

        break;
      }
    }

    gsap.to(this.model.position, {
      ...model.position,
      duration: 1.5,
    });
    gsap.to(this.model.rotation, {
      ...model.rotation,
      duration: 1.5,
    });
  };

  enableDebug = () => (this._debug = true);

  disableDebug = () => (this._debug = true);

  // Helpers

  _setInitialModelPosition = () => {
    this.model.position.x = -1.5;
    this.model.position.y = 0;
    this.model.position.z = 0;

    if (isMobile) {
      this.model.position.x = 0.5;
      this.model.position.y = -1.05;
      this.model.position.z = 0;
    }

    this.model.rotation.x = 4;
    this.model.rotation.y = 0;
    this.model.rotation.z = 0;
  };

  _animateInitialZoomIn = () => {
    this.camera.position.z = 10000;
    gsap.to(this.camera.position, {
      z: 3,
      duration: 2.5,
      ease: "power4.out",
    });
  };

  _addAxesHelper = () => {
    const axesHelper = new THREE.AxesHelper(3);
    const xColor = new THREE.Color(0xff00ff); // mangenta
    const yColor = new THREE.Color(0xffff00); // yellow
    const zColor = new THREE.Color(0x00ffff); // cyan
    axesHelper.setColors(xColor, yColor, zColor);
    this.scene.add(axesHelper);
  };

  _applyParameters = () => {
    this._bokehPass.uniforms["focus"].value = this.controller.focus;
    this._bokehPass.uniforms["aperture"].value = this.controller.aperture * 0.00001;
    this._bokehPass.uniforms["maxblur"].value = this.controller.maxblur;
    this._filmPass.uniforms["intensity"].value = this.controller.filmIntensity;

    if (this.model) {
      this.model.position.x = this.controller.modelPositionX;
      this.model.position.y = this.controller.modelPositionY;
      this.model.position.z = this.controller.modelPositionZ;

      this.model.rotation.x = this.controller.modelRotationX;
      this.model.rotation.y = this.controller.modelRotationY;
      this.model.rotation.z = this.controller.modelRotationZ;
    }
  };
}

let render3dModel;
window.addEventListener("load", () => (render3dModel = new Render3dModel({ debug: isDebug })));
window.addEventListener("resize", () => (render3dModel = new Render3dModel({ debug: isDebug })), false);

export { render3dModel };
