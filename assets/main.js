import { render3dModel } from "./render_3d_model.js";

export const toggleContent = async (sectionId, animationTarget) => {
  render3dModel.zoomTo(animationTarget);

  const allSections = document.querySelectorAll("section");
  const activeSection = document.getElementById(sectionId);

  if (!activeSection) {
    return;
  }

  const currentActiveSection = document.querySelector(".active");
  if (currentActiveSection != null && currentActiveSection.id !== sectionId) {
    currentActiveSection.classList.remove("active");
    currentActiveSection.querySelector(".more").style.height = "0";
  }

  const activeMore = activeSection.querySelector(".more");
  const isActive = activeSection.classList.contains("active");
  if (activeMore) {
    if (!isActive) {
      activeMore.style.height = activeMore.dataset.height;
      activeSection.classList.add("active");
    } else {
      activeMore.style.height = "0";
      activeSection.classList.remove("active");
    }
  }
};

window.toggleContent = toggleContent;

console.log(
  `
%cHey again!
  
%cIt looks like you are curious about how this is made. 🕵️‍♂️
  
This website is done with the following technologies:
  - %cHTML & CSS%c > basic layout and content structure,
  - %cVanilla JS%c > basic accordion animation, model render,
  - %cBlender%c > 3d model,
  - %cthree.js%c > Blender loader and render,
  - %cShaders%c > post-processing effects,
  - %cGSAP%c > animation tweening.
    
  You can dive deep into the source code at %chttps://github.com/matejhocevar/matejhocevar.github.io%c.
    
  %cHave fun! 👨‍🚀 🚀
  `,
  "font-size: 24px; font-weight: bold; color: white; padding-bottom: 8px;",
  "color: white;",
  "color: #ffd45a; font-weight: bold;",
  "color: white;",
  "color: #ffd45a; font-weight: bold;",
  "color: white;",
  "color: #ffd45a; font-weight: bold;",
  "color: white;",
  "color: #ffd45a; font-weight: bold;",
  "color: white;",
  "color: #ffd45a; font-weight: bold;",
  "color: white;",
  "color: #ffd45a; font-weight: bold;",
  "color: white;",
  "font-size: 14px; color: white;",
  "color: white;",
  "font-size: 18px; color: #ffd45a; font-weight: bold;"
);
