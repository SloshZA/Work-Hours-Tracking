document.addEventListener('DOMContentLoaded', () => {
    const videoElement = document.getElementById('videoFeed');
    const startScanBtn = document.getElementById('startScanBtn');
    const stopScanBtn = document.getElementById('stopScanBtn');
    const resultElement = document.getElementById('barcodeResult');
    const errorElement = document.getElementById('error-area');

    // Ensure ZXing library is loaded (it should be, via CDN)
    if (typeof ZXing === 'undefined') {
        showError('Error: ZXing library not loaded. Check the script tag in HTML.');
        startScanBtn.disabled = true;
        return;
    }

    const codeReader = new ZXing.BrowserMultiFormatReader();
    let selectedDeviceId; // To store the selected camera device ID
    let stream; // To hold the camera stream
    let videoTrack; // Keep track of the video track for constraints
    let imageCapture; // For zoom control
    let zoomCapabilities = null; // Store zoom min/max/step
    let currentZoom = 1; // Start with default zoom
    let initialPinchDistance = 0; // For pinch-zoom calculation

    console.log('ZXing code reader initialized');

    function showError(message) {
        console.error(message);
        resultElement.textContent = 'Error';
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }

    function clearError() {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }

    // --- Pinch-to-Zoom Functions ---

    function getDistance(touches) {
        const touch1 = touches[0];
        const touch2 = touches[1];
        return Math.sqrt(
            Math.pow(touch2.clientX - touch1.clientX, 2) +
            Math.pow(touch2.clientY - touch1.clientY, 2)
        );
    }

    function handleTouchStart(event) {
        if (event.touches.length === 2) {
            event.preventDefault(); // Prevent default pinch actions like page zoom
            initialPinchDistance = getDistance(event.touches);
            console.log('Pinch start, initial distance:', initialPinchDistance);
        }
    }

    function handleTouchMove(event) {
        if (event.touches.length === 2) {
            event.preventDefault();
            if (initialPinchDistance <= 0 || !zoomCapabilities || !zoomCapabilities.supported) {
                return; // No starting point or zoom not supported
            }

            const currentPinchDistance = getDistance(event.touches);
            const deltaDistance = currentPinchDistance - initialPinchDistance;

            // Adjust sensitivity: smaller factor = less sensitive zoom
            const zoomSensitivityFactor = 0.01;
            let zoomChange = deltaDistance * zoomSensitivityFactor;

            // Calculate new zoom level based on change
            let newZoom = currentZoom + zoomChange;

            // Clamp the new zoom level within the camera's capabilities
            newZoom = Math.max(zoomCapabilities.min, Math.min(zoomCapabilities.max, newZoom));

            // Apply the zoom if it has changed significantly (avoid tiny adjustments)
            if (Math.abs(newZoom - currentZoom) > (zoomCapabilities.step / 2 || 0.01)) {
                 applyZoom(newZoom);
                 // Update currentZoom *after* applying, or based on actual applied value if possible
                 currentZoom = newZoom; // Update our tracked zoom level
            }

            // Update initial distance for the next move event to calculate relative change
            initialPinchDistance = currentPinchDistance;
        }
    }

    function handleTouchEnd(event) {
        // Reset initial distance when fingers are lifted
        if (event.touches.length < 2) {
            initialPinchDistance = 0;
        }
    }

    async function applyZoom(zoomValue) {
        if (!videoTrack || !zoomCapabilities || !zoomCapabilities.supported) {
            console.warn('Zoom not supported or video track not available.');
            return;
        }

        // Clamp value just in case
        const clampedZoom = Math.max(zoomCapabilities.min, Math.min(zoomCapabilities.max, zoomValue));

        console.log(`Applying zoom: ${clampedZoom} (Min: ${zoomCapabilities.min}, Max: ${zoomCapabilities.max}, Step: ${zoomCapabilities.step})`);

        try {
            await videoTrack.applyConstraints({
                advanced: [{ zoom: clampedZoom }]
            });
            currentZoom = clampedZoom; // Update current zoom state
            console.log('Zoom applied successfully.');
        } catch (err) {
            console.error('Error applying zoom constraint:', err);
            // Optionally show a user-facing error, but might be annoying during pinch
            // showError(`Zoom Error: ${err.message}`);
        }
    }

    // --- Scanning Functions ---

    async function startScan() {
        clearError();
        resultElement.textContent = 'Starting camera...';
        startScanBtn.style.display = 'none';
        stopScanBtn.style.display = 'inline-block';

        try {
            const videoInputDevices = await codeReader.listVideoInputDevices();
            if (videoInputDevices.length === 0) {
                throw new Error('No camera devices found.');
            }

            const backCamera = videoInputDevices.find(device => /back|environment/i.test(device.label));
            selectedDeviceId = backCamera ? backCamera.deviceId : videoInputDevices[0].deviceId;
            console.log(`Using video device: ${selectedDeviceId}`);
            resultElement.textContent = 'Accessing camera...';

            stream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: selectedDeviceId } }
            });
            videoElement.srcObject = stream;
            // Wait for metadata to ensure dimensions are available if needed later
            await new Promise((resolve) => { videoElement.onloadedmetadata = resolve; });
            await videoElement.play(); // Ensure video is playing

            videoTrack = stream.getVideoTracks()[0];

            // --- Initialize ImageCapture and check zoom ---
            if ('ImageCapture' in window) {
                try {
                    imageCapture = new ImageCapture(videoTrack);
                    const capabilities = await imageCapture.getPhotoCapabilities();
                    console.log('Camera Capabilities:', capabilities);
                    if (capabilities.zoom && capabilities.zoom.max > capabilities.zoom.min) {
                        zoomCapabilities = {
                            supported: true,
                            min: capabilities.zoom.min,
                            max: capabilities.zoom.max,
                            step: capabilities.zoom.step
                        };
                        currentZoom = videoTrack.getSettings().zoom || zoomCapabilities.min || 1;
                        console.log(`Zoom supported: Min=${zoomCapabilities.min}, Max=${zoomCapabilities.max}, Step=${zoomCapabilities.step}, Current=${currentZoom}`);
                        videoElement.addEventListener('touchstart', handleTouchStart, { passive: false });
                        videoElement.addEventListener('touchmove', handleTouchMove, { passive: false });
                        videoElement.addEventListener('touchend', handleTouchEnd);
                    } else {
                        console.warn('Zoom is not supported by this camera/browser.');
                        zoomCapabilities = { supported: false };
                    }
                } catch (captureError) {
                    console.error('Error initializing ImageCapture:', captureError);
                    zoomCapabilities = { supported: false };
                }
            } else {
                console.warn('ImageCapture API not supported by this browser.');
                zoomCapabilities = { supported: false };
            }
            // --- End ImageCapture setup ---

            // --- MODIFICATION START ---
            // Update status *before* starting the decode loop callback
            resultElement.textContent = 'Scanning... Point camera at a barcode.';
            console.log('decodeFromVideoElement initiated.');
            // --- MODIFICATION END ---

            codeReader.decodeFromVideoElement(videoElement, (result, err) => {
                 if (result) {
                    console.log('Barcode found:', result);
                    resultElement.textContent = `Format: ${result.getBarcodeFormat()}\nData: ${result.getText()}`;
                    if (navigator.vibrate) {
                        navigator.vibrate(100);
                    }
                }
                if (err && !(err instanceof ZXing.NotFoundException)) {
                    // Log non-NotFound errors but don't necessarily stop continuous scan
                    console.error('Decoding error:', err);
                }
                 // No longer need to update from 'Accessing...' here
                 // if (!result && resultElement.textContent.startsWith('Accessing')) {
                 //     resultElement.textContent = 'Scanning... Point camera at a barcode.';
                 // }
            }).catch((err) => {
                // Catch errors specifically from starting the decode process
                console.error('Error starting decodeFromVideoElement:', err);
                showError(`Decoder Start Error: ${err.message}.`);
                stopScan(); // Stop if the decoder itself fails to start
            });

        } catch (err) {
            console.error('Error in startScan:', err);
            // Handle errors from getUserMedia, play(), etc.
            showError(`Camera/Device Error: ${err.message}. Please ensure permissions are granted.`);
            stopScan(); // Ensure UI resets on error
        }
    }

    function stopScan() {
        console.log('Stopping scan.');
        codeReader.reset(); // Reset the decoder

        // Remove touch listeners
        videoElement.removeEventListener('touchstart', handleTouchStart);
        videoElement.removeEventListener('touchmove', handleTouchMove);
        videoElement.removeEventListener('touchend', handleTouchEnd);

        if (stream) {
            stream.getTracks().forEach(track => track.stop()); // Stop camera stream tracks
        }
        stream = null;
        videoTrack = null;
        imageCapture = null;
        zoomCapabilities = null;
        initialPinchDistance = 0;
        currentZoom = 1; // Reset zoom state

        videoElement.srcObject = null;
        videoElement.pause();
        videoElement.removeAttribute('src');

        resultElement.textContent = 'Stopped.';
        startScanBtn.style.display = 'inline-block';
        stopScanBtn.style.display = 'none';
        clearError(); // Clear any previous errors
    }

    // Event Listeners
    startScanBtn.addEventListener('click', startScan);
    stopScanBtn.addEventListener('click', stopScan);

    // Initial state
    resultElement.textContent = 'Click "Start Scan" to begin.';

}); 