<template>
  <main>
    <div id="stage"></div>
  </main>
</template>

<script>
import { Stage } from "@/lib/glue/Glue.js";

export default {
  name: "App",
  mounted() {
    const stageElement = document.getElementById('stage');
    const glue = new Stage(stageElement);
  }
};
</script>
