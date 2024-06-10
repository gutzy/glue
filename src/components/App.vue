<template>
  <main>
    <div id="stage"></div>
  </main>
</template>

<script>
import { Stage } from "@/lib/glue/Glue.js";
const config = {
  cameraType: 'perspective',
  enableControls: true,
  enablePan: true,
  enableZoom: true,
  enableRotate: true,
  enableDrag: true,
};

export default {
  name: "App",
  mounted() {
    const stageElement = document.getElementById('stage');
    const glue = new Stage(stageElement, config);
  }
};
</script>
