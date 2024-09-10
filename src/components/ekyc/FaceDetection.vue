<template>
    <div>
        <a-alert style=" margin-bottom:10px;"  v-if="!loadingVideo" c :message="`${ ekycNoticeMessage }`" :type="typeMessage"  ></a-alert>

        <VideoBox>
            <div v-if="loadingVideo" class="pre-loading-video">
                <a-spin size="large"  tip="Đang mở camera..." spinning />
            </div>
            <div class="video-box"  :style="videoBoxStyle">
                <video style=" max-width: 100%;" v-show="!isPhotoTaken" ref="camera" webkit-playsinline playsinline autoplay :onPlay="handleGetUserMedia"></video>
                <canvas id="photoTaken" ref="canvas"  style="max-width: 100%; position: absolute; top: -25px; left: 0;" :width="canvasWidth" :height="canvasHeight" ></canvas>
            </div>
        </VideoBox>
        <img :src="srcImgDemo" :width="400" v-show="srcImgDemo.length > 0"  />
        <a-button  type="primary" @click="captureDemoImage" >Chụp ảnh</a-button>

    </div>
</template>
<script>
import { isMobile } from 'mobile-device-detect';

import { defineComponent, ref, onMounted, watch } from 'vue';
import propTypes from "vue-types"; 
import { FaceMesh } from "@mediapipe/face_mesh";

  
import { shuffleFromPositionOne } from "@/utility/ekyc/shuffle-array";
import { setIntervalAsync } from "set-interval-async/dynamic";
import { clearIntervalAsync } from "set-interval-async";
import { checkFaceFitsEllipse, faceLiveNessCheck } from "@/utility/ekyc/face-liveness";

import { VideoBox } from './style.js'
import delay from "@/utility/ekyc/delay";

import { Howl } from "howler";
  


export default defineComponent({
    
    components: {
        VideoBox
    },
    props: {
        open: propTypes.boolean
    },
    emits: ['DataImage','closemodalkyc'],

    setup(props, {emit}) { 


        let confirmAudio = new Howl({ src: ["/component/confirm.wav"] });
        let alertAudio = new Howl({ src: ["/component/alert.mp3"] });

        const faceActions = [
            { action: "forward", message: "Nhìn thẳng về phía máy ảnh" },
            { action: "up", message: "Quay lên trên" },
            { action: "down", message: "Quay xuống dưới" },
            { action: "left", message: "Quay sang trái" },
            { action: "right", message: "Quay sang phải" },
            { action: "eye-closed", message: "Nhắm mắt" },
            
        ];
        //ellipse message action
        const ellipseAction = [
            { action: "camera-far", message: "Vui lòng đưa camera xa hơn" },
            { action: "camera-near", message: "Vui lòng đưa camera lại gần hơn " },
            { action: 'keep-straight', message: 'Vui lòng giữ yên camera' },
            { action: 'camera-straight', message: 'Vui lòng nhìn thẳng' }
        ];

        const getActionsSequence = () => {
            let sequence = shuffleFromPositionOne(faceActions);

            sequence.push(faceActions[0]);
            return sequence;
        };

                
        let setUpFaceDetectionCallBack = ref(false);
        let stepRef = ref(0);
        let firstStepDelayRef = ref(true);
        //let validFrameCountRef = ref(0);
        let faceImageRef = ref(null);
        // let cameraRef = ref(null);
        let faceMesh = null;

        const randomActionSequenceRef = ref(getActionsSequence());
        //const VALID_FRAME = parseInt(process.env.VUE_APP_LIVENESS_VALID_FRAME);
  
        const isPhotoTaken = ref(false);
        const isCameraOpen = ref(false);
        const sharpness = ref(0);
        const loadingVideo = ref(true);
        const isLoading = ref(false);
        const cameraType = ref('user');
        const camera = ref(null);
        const canvas = ref(null);
        const image = ref(''); 
        //new 
        const typeMessage = ref('warning');
        const srcImgDemo = ref('');
        const ekycNoticeMessage = ref('Vui lòng nhìn thẳng.');
        const validFaceInEllipse = ref(false);
        const canvasWidth = ref(600);
        const canvasHeight = ref(400);
        const ellipseRadiusConstX = ref(120);
        const ellipseRadiusConstY = ref(170);
        const videoBoxStyle = ref({});
       
        

        var nh_url = 'https://nhanhoa.com/khuyenmai/landing_id_vn/assets/ekyc';
        if(process.env.NODE_ENV !== "production"){
            nh_url = '';
        }
        const handleGetUserMedia = (async () => {

            randomActionSequenceRef.value = getActionsSequence();
            
        
            faceMesh = new FaceMesh({
                locateFile: (file) => {
                    return nh_url+"/component/face_mesh/" + file;
                },
            });
            faceMesh.setOptions({
                selfieMode: true,
                maxNumFaces: 1,
                refineLandmarks: true,
            });

             // Start an interval for face detecting
            const timer = setIntervalAsync(async () => {
                if(camera.value == null){
                    return false;
                }
                const context = canvas.value.getContext('2d');
                        
                // Clear the canvas on every frame
                context.clearRect(0, 0, canvas.value.width, canvas.value.height);
                context.fillStyle = 'rgba(255, 255, 255, 1)'; // Light gray with some transparency
                context.fillRect(0, 0, canvas.value.width, canvas.value.height);

                // Draw the ellipse on the canvas (centered)
                const ellipseCenterX = canvas.value.width / 2;
                const ellipseCenterY = canvas.value.height / 2;
                const ellipseRadiusX = ellipseRadiusConstX.value;  // Horizontal radius
                const ellipseRadiusY = ellipseRadiusConstY.value;  // Vertical radius
                context.globalCompositeOperation = 'destination-out';
                context.beginPath();
                context.ellipse(ellipseCenterX, ellipseCenterY, ellipseRadiusX, ellipseRadiusY, 0, 0, 2 * Math.PI);
                context.fill();

                // Reset composite operation to default for drawing face landmarks
                context.globalCompositeOperation = 'source-over';
                drawEllipse(context, ellipseCenterX, ellipseCenterY, ellipseRadiusX, ellipseRadiusY);

                // Setting up callback for face detection for the first time
                if (!setUpFaceDetectionCallBack.value) {
                    console.log("Start liveness check");
                    setUpFaceDetectionCallBack.value = true;
                    
                    faceMesh.onResults(async (results) => {
                        // Just to check if the countdown reset the step in-between the face liveness check
                        let currentStep = stepRef.value;
                        //vẽ chấm xanh để so sánh
                        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
                            if(results.multiFaceLandmarks.length == 1){
                                drawFaceLandmarks(context, results.multiFaceLandmarks[0]);
                            }
                            else{
                                console.log(`Chỉ nhận một khuôn mặt khi eKYC`);
                                // typeMessage.value = 'error';
                            }
                        }
                        //vẽ chấm xanh để so sánh
                        //check face in ellipse
                        if(results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0){
                            const checkFitEllipse = checkFaceFitsEllipse(results.multiFaceLandmarks[0], ellipseCenterX, ellipseCenterY, ellipseRadiusX, ellipseRadiusY, isMobile);
                            
                            if(checkFitEllipse < 0.83){
                                typeMessage.value = 'warning';
                                ekycNoticeMessage.value = findActionByKey('camera-near') + " Point: " +checkFitEllipse;
                                alertAudio.play();
                                validFaceInEllipse.value = false;
                            }
                            else if(checkFitEllipse > 1.4){
                                typeMessage.value = 'warning';
                                ekycNoticeMessage.value = findActionByKey('camera-far') + " Point: " +checkFitEllipse;
                                alertAudio.play();
                                validFaceInEllipse.value = false;
                            }
                            else if(!faceLiveNessCheck(results, 'forward')){
                                typeMessage.value = 'warning';
                                ekycNoticeMessage.value = findActionByKey('camera-straight') + " Point: " +checkFitEllipse;
                                alertAudio.play();
                                validFaceInEllipse.value = false;
                            }
                            else{
                                // typeMessage.value = 'warning';
                                // ekycNoticeMessage.value = findActionByKey('keep-straight')+ " Point: " +checkFitEllipse;
                                // alertAudio.play();
                                // validFaceInEllipse.value = false;
                                
                            }
                            //console.log("Running...");
                            if((checkFitEllipse > 0.83 && checkFitEllipse < 1.4 ) && faceLiveNessCheck(results, 'forward')){
                                typeMessage.value = 'success';
                                validFaceInEllipse.value = true;
                                //debug
                                currentStep = 0;
                                console.log(currentStep);

                                drawEllipse(context, ellipseCenterX, ellipseCenterY, ellipseRadiusX, ellipseRadiusY, 'green');
                                ekycNoticeMessage.value = "Đang xử lý. Vui lòng giữ yên camera....";
                                console.log("Start capture..............",checkFitEllipse);
                                confirmAudio.play();
                                faceImageRef.value = results.image.toDataURL("image/jpeg");
                                // if(validFaceInEllipse.value){
                                //     await delay(3000);
                                    
                                //     console.log("End capture..............",checkFitEllipse, validFaceInEllipse.value);
                                //     confirmAudio.play();
                                //     srcImgDemo.value = faceImageRef.value;
                                //     isCameraOpen.value = false;
                                //     // isPhotoTaken.value = false;
                                //     let tracks = camera.value.srcObject.getTracks();
                                //     tracks.forEach(async track => {
                                //         await delay(1000)
                                //         track.stop();
                                //     });
                                    
                                //     //close modal ekyc
                                //     //emit("closemodalkyc", true);
                                    
                                //     clearIntervalAsync(timer);
                                // }
                            }
                            
                            
                        }
                        else{
                            typeMessage.value = 'warning';
                            ekycNoticeMessage.value = "không tìm thấy khuôn mặt."
                            validFaceInEllipse.value = false;
                        }
                        //end check face in ellipse

                        // Check if the user moves the face outside of the camera
                        
                        // if (
                        //     results.multiFaceLandmarks &&
                        //     results.multiFaceLandmarks.length === 0 &&
                        //     stepRef.value !== 0
                        // ) {
                        //     firstStepDelayRef.value = true;
                        //     alertAudio.play();
                        //     validFrameCountRef.value = 0;
                        //     randomActionSequenceRef.value = getActionsSequence();
                        //     stepRef.value = 0;
                        // }
                        // // Check if the user does the required action for VALID_FRAME number of frames.
                        // else if (
                        //     faceLiveNessCheck(
                        //     results,
                        //     randomActionSequenceRef.value[currentStep].action
                        //     ) &&
                        //     currentStep === stepRef.value
                        // ) {
                        //     if (validFrameCountRef.value < VALID_FRAME) {
                        //     validFrameCountRef.value += 1;
                        //     } else {
                        //     // If first step, take the picture
                        //     if (stepRef.value === 0) {
                        //         const canvas = results.image;
                        //         if(canvas === null) return false;
                        //         const { x1, x2, y1, y2 } = getBoundingBox(results);
                        //         // Check if the face is fully presented
                        //         if (
                        //         x1 >= 0 &&
                        //         y1 >= 0 &&
                        //         x2 <= canvas.width &&
                        //         y2 <= canvas.height
                        //         ) {
                        //             faceImageRef.value = results.image.toDataURL("image/jpeg");
                        //             confirmAudio.play();
                        //             validFrameCountRef.value = 0;
                        //             stepRef.value += 1;
                        //         }
                        //     } else {
                        //         if (
                        //         stepRef.value !==
                        //         randomActionSequenceRef.value.length - 1
                        //         ) {
                        //             confirmAudio.play();
                        //             validFrameCountRef.value = 0;
                        //             stepRef.value += 1;
                        //         } else {
                        //             confirmAudio.play();
                        //             console.log("Stop liveness check end step 1");
                        //             stopCameraStream();
                        //             isPhotoTaken.value = true;
                        //             //close modal ekyc
                        //             emit("closemodalkyc", true);
                        //             clearIntervalAsync(timer);
                        //         }
                        //     }
                        //     }
                        // }
                        // // Reset frame count when the user fails the liveness check
                        // else if (currentStep === stepRef.value) {
                        //     validFrameCountRef.value = 0;
                        // }
                        
                    });
                    
                    


                }
        
                await faceMesh.send({ image: camera.value });
                // Start to process frame by frame
                if (
                    camera.value !== null
                ) {
                    if (stepRef.value === 0 && firstStepDelayRef.value) {
                    await delay(1000);
                    firstStepDelayRef.value = false;
                    }
                    // Detect face, execute the callback function
                    await faceMesh.send({ image:  camera.value });
                } else {
                
                    console.log("Stop liveness check 2");
                    clearIntervalAsync(timer);
                    
                }
            }, 10);

        })
        
        //find message by action
        const findActionByKey = (actionToFind) => {
            const item = ellipseAction.find(item => item.action === actionToFind);
            return item?.message;
        }
        // Function to draw the ellipse
        const drawEllipse = (context, x, y, rx, ry, styleColor="blue") => {
            context.beginPath();
            context.ellipse(x, y, rx, ry, 0, 0, 2 * Math.PI);
            context.strokeStyle = styleColor;  // Ellipse color
            context.lineWidth = 3;         // Ellipse border thickness
            context.stroke();
        }
        // Function to draw face landmarks for feedback
        const drawFaceLandmarks = (context, landmarks) => {
            context.fillStyle = 'green';
            for (let i = 0; i < landmarks.length; i++) {
                let x = landmarks[i].x* 600;  // Adjust for canvas size
                let y = landmarks[i].y *400;
                if(isMobile){
                    x = landmarks[i].x* 600;  // Adjust for canvas size
                    y = landmarks[i].y *400;
                }
                context.fillRect(x, y, 3, 3);    // Small dot for each landmark
            }
        }

        const captureDemoImage = () => {
            console.log(faceImageRef.value, 'faceImageRef');
            srcImgDemo.value = faceImageRef.value;
        }
        const handleOpenCamera = () => {
            image.value = "";
            isPhotoTaken.value = false;
            isCameraOpen.value = true;
            createCameraElement();
        };
        const  createCameraElement = (async() => {
            isLoading.value = true;
            const constraints = {
                audio: false,
                video: {
                    facingMode:  "user",
                    width: { min: 1280, max: 1920, ideal: 1440 },
                    height: { ideal: isMobile ? 1440 : 1080 },
                    aspectRatio: { ideal: isMobile ? 1.333333333 : 1.777777778 },
                }
            }
            await navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
                isLoading.value = false;
                camera.value.srcObject = stream;
                loadingVideo.value = false;
            }).catch((error) => {
                isLoading.value = false;
                alert("May the browser didn't support or there is some errors.");
                console.log(error);
            })
        })
   

        const stopCameraStream = () => {
            emit('DataImage', faceImageRef.value);
            isCameraOpen.value = false;
            // isPhotoTaken.value = false;
            let tracks = camera.value.srcObject.getTracks();
             tracks.forEach(async track => {
                await delay(1000)
                track.stop();
            });
        }

        const changeCam = () => {
            stopCameraStream();
            cameraType.value = cameraType.value == "user" ? "environment" : "user"
            handleOpenCamera();
        }
        
        onMounted(() => {
            if (window.innerWidth < 991) {
                videoBoxStyle.value.height = '240px';
                ellipseRadiusConstX.value = 150;
                ellipseRadiusConstY.value = 200;
            }
            handleOpenCamera();
            
        })
        
        watch(() => props.open, () => { 

            if(!props.open) {
                stopCameraStream();
            }

        })

        return {
            handleGetUserMedia,
            isPhotoTaken,
            isCameraOpen,
            handleOpenCamera,
            changeCam,
        
            camera,
            canvas,
            isLoading,
            loadingVideo,
            image,
            sharpness,
            randomActionSequenceRef,
            stepRef,
            //new
            typeMessage,
            captureDemoImage,
            srcImgDemo,
            ekycNoticeMessage,
            canvasWidth,
            canvasHeight,
            videoBoxStyle
        }
    }
});

</script>
<style scoped>
    @media (max-width: 992px) {
        #photoTaken{
            top: 0px !important;
            height: 101% !important;
        }
    }
</style>