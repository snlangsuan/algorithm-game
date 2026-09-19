<script setup lang="ts">
import { WHITE, type Player } from '~/game/othello/engine'

defineProps<{ player: Player }>()
</script>

<template>
  <div class="disc" :class="player === WHITE ? 'is-white' : 'is-black'">
    <span class="face front" />
    <span class="face back" />
  </div>
</template>

<style scoped>
.disc {
  position: relative;
  width: 82%;
  height: 82%;
  transform-style: preserve-3d;
  transition: transform 350ms cubic-bezier(0.4, 0, 0.2, 1);
  animation: drop 200ms ease-out;
}

.is-white {
  transform: rotateY(180deg);
}

.face {
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  backface-visibility: hidden;
}

.front {
  background: linear-gradient(160deg, #3b2f4d, #1c1524);
  box-shadow: inset 0 2px 3px rgb(255 255 255 / 0.18), 0 2px 4px rgb(28 21 36 / 0.35);
}

.back {
  transform: rotateY(180deg);
  background: linear-gradient(160deg, #ffffff, #ece9f6);
  box-shadow: inset 0 -2px 3px rgb(28 21 36 / 0.12), 0 2px 4px rgb(28 21 36 / 0.28);
}

@keyframes drop {
  from {
    opacity: 0.4;
    scale: 0.6;
  }
  to {
    opacity: 1;
    scale: 1;
  }
}
</style>
