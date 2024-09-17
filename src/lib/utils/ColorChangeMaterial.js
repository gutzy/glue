import * as THREE from 'three';

function modifyTextureColors(texture, originalColorsHex, targetColorsHex) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = texture.image.width;
  canvas.height = texture.image.height;
  context.drawImage(texture.image, 0, 0);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  let data = imageData.data;

  // Convert hex colors to RGB
  const originalColorsRGB = originalColorsHex.map(hex => ({
    r: (hex >> 16 & 255) / 255,
    g: (hex >> 8 & 255) / 255,
    b: (hex & 255) / 255
  }));
  const targetColorsRGB = targetColorsHex.map(hex => ({
    r: (hex >> 16 & 255) / 255,
    g: (hex >> 8 & 255) / 255,
    b: (hex & 255) / 255
  }));

  // Iterate over each pixel and replace colors
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] / 255;
    let g = data[i + 1] / 255;
    let b = data[i + 2] / 255;

    originalColorsRGB.forEach((color, index) => {
      if (!targetColorsRGB[index]) return;
      const dist = Math.sqrt(
        (color.r - r) * (color.r - r) +
        (color.g - g) * (color.g - g) +
        (color.b - b) * (color.b - b)
      );
      if (dist < 0.05) {
        // Color match, replace pixel color
        data[i] = targetColorsRGB[index].r * 255;
        data[i + 1] = targetColorsRGB[index].g * 255;
        data[i + 2] = targetColorsRGB[index].b * 255;
      }
    });
  }

  // Write modified data back and update texture
  context.putImageData(imageData, 0, 0);
  texture.image = canvas;
  texture.needsUpdate = true;
  return texture;
}


export function applyCustomMaterialToGLB(glbObject, originalColorsHex, targetColorsHex) {
    glbObject.traverse(child => {
    if (child.isMesh && child.material.map) {
      if (child.material.originalMap) {
        child.material.map.image = child.material.originalMap;
      }
      else { // save the original texture on a canvas for later restoration
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = child.material.map.image.width;
        canvas.height = child.material.map.image.height;
        context.drawImage(child.material.map.image, 0, 0);
        child.material.originalMap = canvas;
      }
      child.material.map = modifyTextureColors(child.material.map, originalColorsHex, targetColorsHex);
      child.material.needsUpdate = true;
    }
    else {
      console.warn("The provided GLB object does not contain a mesh with a texture map");
    }
  });
}
