
<template>
  <EkycForm>
    <template v-if="currentStep === 'ekycHelp'" >
      <help-ekyc @comfirm="handleBeginProcess" />
    </template>
    <template v-if="currentStep === 'cardFront' && !isUpload"  >
      <a-modal   :visible="visibleModal" title="Hình CMND/CCCD mặt trước">
      <template #footer>
        <a-button key="back" @click="handleCancelPopup">Đóng</a-button>
        <a-button key="submit" type="primary" :loading="loading" @click="handleOk" v-if="is_show_capture"><CameraOutlined /> Chụp ảnh</a-button>
        <a-button key="waiting" type="default" :loading="loading" @click="handleOk" v-if="!is_show_capture">Đang xử lý...</a-button>
      </template>
        <Suspense>
          <template #default>
            <CardDetection :open="open" @DataImage="handlecardFront"/>
          </template>
        </Suspense>
      </a-modal>
    </template>

     <template v-if="currentStep === 'cardBack' && !isUpload" >
      <a-modal @cancel="handleCancelPopup" :visible="visibleModal" title="Hình CMND/CCCD mặt sau">
        <Suspense>
          <template #default>
            <CardDetection v-if="!isUpload" :open="open" @DataImage="handleBackCard"/>
          </template>
        </Suspense>
        
      </a-modal>
    </template>

     <template v-if="currentStep === 'face'" >
      <a-modal @cancel="handleCancelPopup" :visible="visibleModal" title="Hình khuôn mặt">
        <Suspense>
          <template #default>
            <FaceDetection :open="open" @DataImage="handleFaceId"/>
          </template>
        </Suspense>
        
      </a-modal>
    </template>

      <a-row>
        <a-col :span="8">
          <a-timeline>
            <a-timeline-item>
              <template #dot v-if="currentStep === 'cardFront' ">
                
              </template>
              Ảnh CCCD mặt trước
            </a-timeline-item>
            <a-timeline-item>
              <template #dot v-if="currentStep === 'cardBack' ">
                
              </template>
              Ảnh CCCD mặt sau
            </a-timeline-item>
            <a-timeline-item>
              <template #dot v-if="currentStep === 'face' ">
               
              </template>
              Kiểm tra sinh trắc
            </a-timeline-item>
            <a-timeline-item>Hoàn tất</a-timeline-item>
          </a-timeline>
        </a-col>

        <a-col :span="16">
          
          <a-row>
            <a-col :span="24" v-if="currentStep === 'cardFront'">
              <a-card title="Ảnh CCCD mặt trước">
                <img :src="cardimageFront" style="width: 100%" />
                <a-spin tip="Đang kiểm tra dữ liệu" v-if="isDetectingData" />
                <div class="cardimage cardimage-front" v-else>
                  <a-upload :max-count="1"  :before-upload="beforeUploadFrontCard" :capture="null" accept="image/png, image/jpeg" listType="picture">
                    <a-button type="primary" outlined block>
                      <unicon name="upload" width="40"/>
                      Chọn ảnh từ máy
                    </a-button>
                    <br />
                    <a-button @click="handleBegin" type="light" block>
                      <unicon name="camera" width="40"/>
                      Chụp ảnh từ camera
                    </a-button>
                  </a-upload>
                </div>
              </a-card>
            </a-col>

            <a-col :span="24" v-if="currentStep === 'cardBack'">
               <a-card title="Ảnh CCCD mặt sau">
                <img :src="cardimageBack" style="width: 100%" />
                  <a-spin tip="Đang kiểm tra dữ liệu" v-if="isDetectingData" />
                  <div class="cardimage cardimage-back" v-else>
                    <a-upload v-if="isUpload" :max-count="1" :capture="null"  accept="image/png, image/jpeg" listType="picture"
                      :before-upload="beforeUploadBackCard"
                    >
                    <a-button type="primary" outlined block>
                      <unicon name="upload" width="40"/>
                      Chọn ảnh từ máy
                    </a-button>
                    </a-upload>
                  </div>
                </a-card>
            </a-col>
            <a-col  :span="24" v-if="currentStep === 'face'" >
              <a-card title="Xác thực khuôn mặt">
                <a-row :gutter="[25,25]">
                  <a-col :span="12"> <img :src="cardimageFront" style="width: 100%" /></a-col>
                  <a-col :span="12"> <img :src="cardimageBack" style="width: 100%" /></a-col>
                </a-row>
                  <a-spin tip="Đang kiểm tra dữ liệu" v-if="isDetectingData" />
                </a-card>
                
            </a-col>
          </a-row>
          
        </a-col>
        <a-col :span="24"  v-if="currentStep === 'face'">
          <div style="text-align:right; margin-top:10px;">
            <a class="re_ekyc ant-btn ant-btn-warning" @click="reAction" v-if="true" style="margin-top:10px;">
              Thực hiện lại
            </a>
          </div>
        </a-col>
        <a-col :span="24"  v-if="currentStep === 'failed'">
          <a-card>
            Lỗi.
          </a-card>
        </a-col>
        <a-col :span="24"  v-if="currentStep === 'complate'">
          <a-card>
            Đã định danh thông tin hoàn tất.
          </a-card>
        </a-col>
      </a-row>
      
  </EkycForm>
  
</template>

<script>
/* eslint-disable */
 import { EkycForm } from './style.js'
 import { isMobile } from 'mobile-device-detect';

import { message } from 'ant-design-vue'
import { defineComponent, ref } from "vue";
import CardDetection from "@/components/ekyc/CardDetection.vue";
import FaceDetection from "@/components/ekyc/FaceDetection.vue";
import HelpEkyc from "@/components/ekyc/HelpEkyc.vue";
import delay from "@/utility/ekyc/delay";
import propTypes from "vue-types";
import { resizeImage } from "@/utility/ekyc/image-util";

import ApiFactory from '@/clientApi/ApiFactory'; 
const EkycApi = ApiFactory.get('EkycApi');

export default defineComponent({
  name: "EKYCForm",
  components: {
    CardDetection,
    FaceDetection,
    HelpEkyc,
    EkycForm
  },
  props: {
    contact_id: propTypes.init
  },
  emits: ['UserData'],
  setup(props, {emit}){

    // const {contact_id} = toRefs(props)

    // const id = contact_id.value;

    const cardimageFront = ref('')
    const cardimageBack = ref('')
    const currentStep = ref('cardFront')
    const visibleModal = ref(true)
    const open = ref(true)
    const requestId = 'NH' +Date.now().toString();
    const isDetectingData = ref(false)
    const frontData = ref([]);
    const backData = ref([]);
    const isUpload = ref(true);
    //anhdq
    const is_show_capture = ref(false);

    const resetForm = () => {
      cardimageFront.value = '';
      cardimageBack.value = '';
      open.value = true;
      visibleModal.value = true;
      isDetectingData.value = false; 
      localStorage.setItem("nh_img_front", '');
      localStorage.setItem("nh_img_back", '');
      localStorage.setItem("nh_img_faceid", '');
    }
    const reAction = () => {
      console.log('reAction');
      cardimageFront.value = '';
      cardimageBack.value = '';
      open.value = true;
      visibleModal.value = true;
      isDetectingData.value = false; 
      localStorage.setItem("nh_img_front", '');
      localStorage.setItem("nh_img_back", '');
      localStorage.setItem("nh_img_faceid", '');
      isUpload.value = true
      open.value = false
      visibleModal.value = false
      currentStep.value = "cardFront";
    }
    const delayStep = (async() => {
      await delay(5000);
    })

    const handlecardFront = (DataImage) => {
      currentStep.value = "cardFront";
      cardimageFront.value = DataImage;
      visibleModal.value = false;
      isDetectingData.value = true; 
      console.log(DataImage); 
      if(DataImage){
          localStorage.setItem("nh_img_front", DataImage);
          message.info('Chụp ảnh mặt trước thành công!');
          delayStep();
            currentStep.value = "cardBack";
            visibleModal.value = true;
            isDetectingData.value = false;
          return true;
      } else {
        message.info('Không tìm thấy ảnh mặt trước!');
        localStorage.setItem("nh_img_front", '');
        currentStep.value = "cardFront";
        isUpload.value = true;
        resetForm();
        return false
      }

      // callOcrRecognitionAPI(DataImage)
      //   .then((response) => {
      //     const isDataValid = validateCardFrontData(response);
      //      console.log(isDataValid)
      //     if (isDataValid) {
      //       delayStep();
      //       currentStep.value = "cardBack";
      //       visibleModal.value = true;
      //       isDetectingData.value = false; 
      //     } else {      
      //       currentStep.value = "cardFront";
      //       isUpload.value = true;
      //       resetForm();
      //     } 
      //   })
      //   .catch((error) => {
      //     console.error("OCR recognition failed:", error);
      //     delayStep();
      //     resetForm()
      //   });

         
    }

    const handleBackCard = (DataImage) => {
      cardimageBack.value = DataImage;
      visibleModal.value = false;
      isDetectingData.value = true;
      currentStep.value = "cardBack";
      console.log(DataImage); 
      if(DataImage){
          localStorage.setItem("nh_img_back", DataImage);
          message.info('Chụp ảnh mặt sau thành công!');
          delayStep();
            currentStep.value = "face";
            visibleModal.value = true;
          return true;
      } else {
        message.info('Không tìm thấy ảnh mặt sau!');
        localStorage.setItem("nh_img_back", '');
        currentStep.value = "cardFront";
        isUpload.value = true;
        resetForm();
        return false
      }
      // return;
      // callOcrRecognitionAPI(DataImage).then((response) => {

      //   console.log('response', response);

      //   const isDataValid = compareCardData(response);
      //   if (isDataValid) {
      //       delayStep();
      //       currentStep.value = "face";
      //       visibleModal.value = true;
      //     } else {      
      //       currentStep.value = "cardFront";
      //       isUpload.value = true;
      //       resetForm();
      //     }
      //     isDetectingData.value = false; 
      // }).catch((error) => {
      //     console.error("OCR recognition failed:", error);
      //     delayStep();
      //     resetForm()
      // })
    }

    const handleFaceId = (faceImageRef) => {
      //console.log(faceImageRef);
      let data_front = localStorage.getItem("nh_img_front");
      let data_back = localStorage.getItem("nh_img_back");
      localStorage.setItem("nh_img_faceid", faceImageRef);
      if(data_front && data_back && faceImageRef){
        isDetectingData.value = true;
        visibleModal.value = false;
        //message.info('Chuan bi upload ekyc');
        
        do_upload_ekyc(data_front, data_back, faceImageRef);
      }
      else{
        currentStep.value = "faield";
        resetForm();
        message.error('Missing eKYC data...');
      }
      
      // isDetectingData.value = true;
      // visibleModal.value = false;
      // callFaceRecognitionAPI(faceImageRef).then((response) => {
      //   const isDataValid = processFaceRecognitionResponse(response);
      //   if (isDataValid) {
      //       delayStep();
      //       currentStep.value = "complate";
      //       emit('UserData', {
      //         request_id: requestId,
      //         frontData: frontData.value,
      //         backData: backData.value,
      //         faceData: response?.data,
      //         frontImage: cardimageFront.value,
      //         backImage: cardimageBack.value,
      //         faceImage: faceImageRef,
      //       })
      //     } else {      
      //       currentStep.value = "faield";
      //       resetForm();
      //     }
      //     isDetectingData.value = false; 
      // }).catch((error) => {
      //     console.error("OCR recognition failed:", error);
      //     delayStep();
      //     resetForm()
      // })
    }

    const handleBegin = () => {
      currentStep.value = "ekycHelp";
      isUpload.value = false;
      resetForm()
    }

    const handleBeginProcess = () => {
      currentStep.value = "cardFront";
    }

    const handleCancelPopup = (async() => {
        isUpload.value = true
        open.value = false
        visibleModal.value = false
        await delay(1000);
        currentStep.value = "cardFront";
    })



    // const callOcrRecognitionAPI = (imageData) => {
    //   // const formData = {'request_id': requestId,  "image": imageData};

    //   const formData = new FormData();
    //   formData.append('request_id', requestId);
    //   formData.append('image', imageData);
    //   formData.append('status', true);
    //   return JSON.stringify(formData);

    //   // const headers = new Headers();
    //   // headers.append('Content-Type', 'application/json'); // Set JSON header
      

    //   // return fetch('/domain_documents&action=getOcrRecognition', {
    //   //   method: 'POST',
    //   //   headers: headers,
    //   //   body: formData
    //   // })
    //   //   .then(response => {
    //   //     if (!response.ok) {
    //   //       throw new Error('API request failed');
    //   //     }
    //   //     return response.json();
    //   //   })
    //   //   .then(data => {
      
    //   //     return data;
    //   //   })
    //   //   .catch(error => {
    //   //     // Xử lý lỗi
    //   //     console.error(error);
    //   //   });
        
      
    //   // return EkycApi.getOcrData(formData);
    // }


    // const callFaceRecognitionAPI = (imageData) => {
    //   const formData = {
    //     'contact_id': id, 
    //     'request_id': requestId, 
    //     'frontData': frontData.value,
    //     'backData': backData.value,
    //     "image_live": imageData, 
    //     "image_card": cardimageFront.value,
    //     "image_card_back": cardimageBack.value
    //   };
    //   return EkycApi.getFaceidData(formData);
    // }
    
    const callFaceRecognitionAPI = (imageData) => {
      // const formData = {
      //   'contact_id': id, 
      //   'request_id': requestId, 
      //   'frontData': frontData.value,
      //   'backData': backData.value,
      //   "image_live": imageData, 
      //   "image_card": cardimageFront.value,
      //   "image_card_back": cardimageBack.value
      // };

      //console.log(frontData.value);

      //const formData = new FormData();
      // formData.append('request_id', requestId);
      // formData.append('frontData', JSON.stringify(frontData.value));
      // formData.append('backData', JSON.stringify(backData.value));
      // formData.append('image_live', imageData);
      // formData.append('image_card', cardimageFront.value);
      // formData.append('image_card_back', cardimageBack.value);
      // console.log('image_live', imageData);
      // let data_front = localStorage.getItem("nh_img_front");
      // let data_back = localStorage.getItem("nh_img_back");
      // localStorage.setItem("nh_faceid", imageData);

      // if(data_front && data_back && imageData){
      //   message.info('Chuan bi upload ekyc');
      // }
      // else{
      //   message.error('Thieu data');
      // }
      return false;
      // const headers = new Headers();
      // headers.append('Content-Type', 'application/json'); // Set JSON header
    

      // return fetch('/domain_documents&action=faceVerification', {
      //   method: 'POST',
      //   headers: headers,
      //   body: formData
      // })
      //   .then(response => {
      //     if (!response.ok) {
      //       throw new Error('API request failed');
      //     }
      //     return response.json();
      //   })
      //   .then(data => {
      //     // Xử lý dữ liệu trả về
      //     return data;
      //   })
      //   .catch(error => {
      //     // Xử lý lỗi
      //     console.error(error);
      //   });

      // return EkycApi.getFaceidData(formData);
    }


    const validateCardFrontData = (data) => {
      //const dataCheck = EkycApi.ocrFrontCardChecking(data);
      frontData.value = data;
      const dataCheck = data;
      console.log(data);
      if(dataCheck){
          localStorage.setItem("nh_img_front", dataCheck);
          message.info('success')
          return true;
      } else {
        message.info('Not find Front Image');
        localStorage.setItem("nh_img_front", '');
        resetForm();
        return false
      }
    }

    const compareCardData = (data) => {
      const dataCheck = EkycApi.ocrBackCardChecking(data, frontData.value);
      backData.value = data
      if(dataCheck.success){
          message.info(dataCheck.message)
          return dataCheck.success
      } else {
        message.info(dataCheck.message)
        resetForm();

      }
    }

    const processFaceRecognitionResponse = (data) => {
      console.log(data, 'face data');

      return;
      // const dataCheck = EkycApi.faceVerificationChecking(data)
      // message.info(dataCheck.message);
      // return dataCheck.success
    }

 
    const handleRemove = () => {
      
    }

    const beforeUploadFrontCard = (file) => {
          isUpload.value = true; 
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onloadend = (async() => {
            var img = new Image;
            img.src = reader.result;

            let resizedImageData = await resizeImage(reader.result);
            cardimageFront.value =  resizedImageData
            handlecardFront(resizedImageData);
          })
       
          return false;
    }

    const beforeUploadBackCard = (file) => {
          isUpload.value = true; 
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onloadend = (async() => {
            var img = new Image;
            img.src = reader.result;
            let resizedImageData = await resizeImage(reader.result);
            cardimageBack.value =  resizedImageData
            handleBackCard(resizedImageData);
          })
          return false;
    }


    return {
      handleBegin,
      handleBeginProcess,
      handlecardFront,
      handleBackCard,
      handleFaceId,
      cardimageFront,
      cardimageBack,
      currentStep,
      handleCancelPopup,
      visibleModal,
      open,
      isDetectingData,
      handleRemove,
      beforeUploadFrontCard,
      beforeUploadBackCard,
      isUpload,
      isMobile,
      reAction
    }
  }
});
</script>
