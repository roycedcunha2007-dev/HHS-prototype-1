# MuscleVerse — Three.js Presentation
## Setup Guide

The website works RIGHT NOW with beautiful procedural 3D models.
To upgrade to photorealistic Sketchfab models, follow these steps:

---

## FOLDER STRUCTURE
```
muscleverse/
├── index.html          ← Open this in browser
├── js/
│   └── presentation.js
├── models/             ← Put your downloaded GLB files here
│   ├── muscular_body.glb
│   ├── sarcomere.glb
│   ├── muscle_fiber.glb
│   └── scaffold.glb
└── README.md
```

---

## HOW TO OPEN
Just double-click `index.html` — no server needed.
For best results, use a local server:
```
cd muscleverse
npx serve .
```
Then open http://localhost:3000

---

## FREE 3D MODELS FROM SKETCHFAB
Download these FREE models (all CC licensed):

### 1. MUSCULAR BODY (Slides 1, 2, 10)
🔗 https://sketchfab.com/3d-models/male-base-muscular-anatomy-0954aa04666d45aab9633009318f7b66
→ Download as GLB → rename to `models/muscular_body.glb`

### 2. SKELETAL MUSCLE CELL (Slides 3, 4)
🔗 https://sketchfab.com/3d-models/skeletal-muscle-cell-anatomy-a491668e5891445e8e29d6ac4abf41bd
→ Download as GLB → rename to `models/sarcomere.glb`

### 3. HEART MODEL (Slide 3 — Cardiac card)
🔗 https://sketchfab.com/3d-models/human-heart-beating-d7c5f72cdeaa4e90977c0b73a17b3174
→ Download as GLB → rename to `models/heart.glb`

### 4. HUMAN SKELETON (Slides 2, 10)
🔗 https://sketchfab.com/3d-models/human-skeleton-rigged-animated-dc44de35ceaf4386a89da26c62feeed3
→ Download as GLB → rename to `models/skeleton.glb`

### BACKUP SEARCH:
Go to https://sketchfab.com/search?q=muscle+anatomy&type=models&downloadable=true
Filter: "Free" + "Downloadable" + Format: GLB

---

## CONTROLS
| Action         | Result           |
|----------------|------------------|
| Click anywhere | Next slide       |
| → Arrow key    | Next slide       |
| ← Arrow key    | Previous slide   |
| Swipe left     | Next slide       |
| Swipe right    | Previous slide   |

---

## ADDING REAL GLB MODELS
In `js/presentation.js`, find the `initSlide1()` function.
Replace `buildProceduralBody(scene)` with:

```javascript
loadGLB(scene, 'models/muscular_body.glb', (model) => {
  // Scale and position the model
  model.scale.setScalar(0.02);
  model.position.y = -1;
  // Apply glowing material
  model.traverse(child => {
    if (child.isMesh) {
      child.material = new THREE.MeshPhysicalMaterial({
        color: 0xcc2244,
        emissive: 0x220011,
        emissiveIntensity: 0.3,
        roughness: 0.5,
        metalness: 0.1
      });
    }
  });
  scene.add(model);
}, () => {
  // Fallback to procedural
  scene.add(buildProceduralBody(scene));
});
```

---

## PRESENTATION SLIDES
1. Hero — "The Future of Muscles"
2. Introduction to the Muscular System
3. Types of Muscles (Skeletal / Smooth / Cardiac)
4. Muscle Structure Zoom-In (Muscle → Sarcomere)
5. Muscle Contraction Mechanism
6. Muscular Dystrophy: Healthy vs Affected
7. Regenerative Medicine & Muscle Scaffolds
8. Artificial Muscles and Bioengineering
9. Future Applications of Artificial Muscles
10. Summary & Key Takeaways
11. Thank You / Questions
