<template>
   <ThemeProvider>
      <EkycForm />
    </ThemeProvider>
</template>

<script>
import 'ant-design-vue/dist/antd.css'; // or 'ant-design-vue/dist/antd.less'

import EkycForm from './components/ekyc/EkycForm.vue';
import { ThemeProvider } from "vue3-styled-components";


export default {
  name: 'App',
  components: {
    EkycForm,
    ThemeProvider
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
