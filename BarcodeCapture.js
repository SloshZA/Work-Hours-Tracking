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
            console.log('Requesting user media with facingMode: environment (exact)');
            resultElement.textContent = 'Accessing rear camera...';

            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { exact: "environment" }
                }
            });

            videoElement.srcObject = stream;
            await new Promise((resolve) => { videoElement.onloadedmetadata = resolve; });
            await videoElement.play();

            videoTrack = stream.getVideoTracks()[0];
            const settings = videoTrack.getSettings();
            console.log('Actual camera settings:', settings);

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
                        currentZoom = settings.zoom || zoomCapabilities.min || 1;
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

            resultElement.textContent = 'Scanning... Point camera at a barcode.';
            console.log('decodeFromVideoElement initiated.');

            codeReader.decodeFromVideoElement(videoElement, (result, err) => {
                 if (result) {
                    console.log('Barcode found:', result);
                    resultElement.textContent = `Format: ${result.getBarcodeFormat()}\nData: ${result.getText()}`;
                    if (navigator.vibrate) {
                        navigator.vibrate(100);
                    }
                }
                if (err && !(err instanceof ZXing.NotFoundException)) {
                    console.error('Decoding error:', err);
                }
            }).catch((err) => {
                console.error('Error starting decodeFromVideoElement:', err);
                showError(`Decoder Start Error: ${err.message}.`);
                stopScan();
            });

        } catch (err) {
            console.error('Error in startScan:', err);
            let message = `Camera/Device Error: ${err.message}.`;
            if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
                message = 'Could not find a suitable rear camera. Please ensure one is available and permissions are granted.';
            } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                message = 'Camera permission denied. Please allow camera access in your browser settings.';
            }
            showError(message);
            stopScan();
        }
    }

    function stopScan() {
        console.log('Stopping scan.');
        codeReader.reset();

        videoElement.removeEventListener('touchstart', handleTouchStart);
        videoElement.removeEventListener('touchmove', handleTouchMove);
        videoElement.removeEventListener('touchend', handleTouchEnd);

        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        stream = null;
        videoTrack = null;
        imageCapture = null;
        zoomCapabilities = null;
        initialPinchDistance = 0;
        currentZoom = 1;

        videoElement.srcObject = null;
        videoElement.pause();
        videoElement.removeAttribute('src');

        resultElement.textContent = 'Stopped.';
        startScanBtn.style.display = 'inline-block';
        stopScanBtn.style.display = 'none';
        clearError();
    }

    // Event Listeners
    startScanBtn.addEventListener('click', startScan);
    stopScanBtn.addEventListener('click', stopScan);

    // Initial state
    resultElement.textContent = 'Click "Start Scan" to begin.';

}); 