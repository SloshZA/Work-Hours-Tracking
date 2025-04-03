document.addEventListener('DOMContentLoaded', () => {
    const videoElement = document.getElementById('videoFeed');
    const startScanBtn = document.getElementById('startScanBtn');
    const stopScanBtn = document.getElementById('stopScanBtn');
    const flipCameraBtn = document.getElementById('flipCameraBtn');
    const resultElement = document.getElementById('barcodeResult');
    const errorElement = document.getElementById('error-area');

    // Ensure ZXing library is loaded (it should be, via CDN)
    if (typeof ZXing === 'undefined') {
        showError('Error: ZXing library not loaded. Check the script tag in HTML.');
        startScanBtn.disabled = true;
        flipCameraBtn.disabled = true; // Disable flip button too
        return;
    }

    const codeReader = new ZXing.BrowserMultiFormatReader();
    let currentStream; // Renamed from 'stream' for clarity
    let currentVideoTrack; // Renamed from 'videoTrack'
    let currentImageCapture; // Renamed from 'imageCapture'
    let currentZoomCapabilities = null; // Renamed from 'zoomCapabilities'
    let currentZoom = 1;
    let initialPinchDistance = 0;

    let videoInputDevices = []; // Store all available video devices
    let currentDeviceId = null; // Store the ID of the currently used device

    console.log('ZXing code reader initialized');

    // Disable flip button initially
    flipCameraBtn.disabled = true;

    function showError(message) {
        console.error(message);
        resultElement.textContent = 'Error';
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        flipCameraBtn.disabled = true; // Disable on error
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
            if (initialPinchDistance <= 0 || !currentZoomCapabilities || !currentZoomCapabilities.supported) {
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
            newZoom = Math.max(currentZoomCapabilities.min, Math.min(currentZoomCapabilities.max, newZoom));

            // Apply the zoom if it has changed significantly (avoid tiny adjustments)
            if (Math.abs(newZoom - currentZoom) > (currentZoomCapabilities.step / 2 || 0.01)) {
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
        if (!currentVideoTrack || !currentZoomCapabilities || !currentZoomCapabilities.supported) {
            console.warn('Zoom not supported or video track not available.');
            return;
        }

        // Clamp value just in case
        const clampedZoom = Math.max(currentZoomCapabilities.min, Math.min(currentZoomCapabilities.max, zoomValue));

        console.log(`Applying zoom: ${clampedZoom} (Min: ${currentZoomCapabilities.min}, Max: ${currentZoomCapabilities.max}, Step: ${currentZoomCapabilities.step})`);

        try {
            await currentVideoTrack.applyConstraints({
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

    async function startScan(deviceId = null) {
        // Stop any existing scan first (important for flipping)
        stopScan(true); // Pass true to keep UI in 'scanning' state visually

        clearError();
        resultElement.textContent = 'Starting camera...';
        startScanBtn.style.display = 'none';
        stopScanBtn.style.display = 'inline-block';
        flipCameraBtn.disabled = true; // Disable initially during start

        try {
            // Get device list only if not already populated
            if (videoInputDevices.length === 0) {
                videoInputDevices = await codeReader.listVideoInputDevices();
                if (videoInputDevices.length === 0) {
                    throw new Error('No camera devices found.');
                }
                console.log('Available video devices:', videoInputDevices);
            }

            // Determine which device ID to use
            if (!deviceId) {
                // Initial scan: prefer back camera
                const backCamera = videoInputDevices.find(device => /back|environment/i.test(device.label));
                currentDeviceId = backCamera ? backCamera.deviceId : videoInputDevices[0].deviceId;
            } else {
                // Flipping: use the provided deviceId
                currentDeviceId = deviceId;
            }

            console.log(`Attempting to use video device: ${currentDeviceId}`);
            resultElement.textContent = 'Accessing camera...';

            currentStream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: currentDeviceId } }
            });
            videoElement.srcObject = currentStream;
            // Wait for metadata to ensure dimensions are available if needed later
            await new Promise((resolve) => { videoElement.onloadedmetadata = resolve; });
            await videoElement.play(); // Ensure video is playing

            currentVideoTrack = currentStream.getVideoTracks()[0];

            // --- Initialize ImageCapture and check zoom ---
            currentZoomCapabilities = { supported: false }; // Reset capabilities
            currentZoom = 1; // Reset zoom
            if ('ImageCapture' in window) {
                try {
                    currentImageCapture = new ImageCapture(currentVideoTrack);
                    const capabilities = await currentImageCapture.getPhotoCapabilities();
                    console.log('Camera Capabilities:', capabilities);
                    if (capabilities.zoom && capabilities.zoom.max > capabilities.zoom.min) {
                        currentZoomCapabilities = {
                            supported: true,
                            min: capabilities.zoom.min,
                            max: capabilities.zoom.max,
                            step: capabilities.zoom.step
                        };
                        currentZoom = currentVideoTrack.getSettings().zoom || currentZoomCapabilities.min || 1;
                        console.log(`Zoom supported: Min=${currentZoomCapabilities.min}, Max=${currentZoomCapabilities.max}, Step=${currentZoomCapabilities.step}, Current=${currentZoom}`);
                        videoElement.addEventListener('touchstart', handleTouchStart, { passive: false });
                        videoElement.addEventListener('touchmove', handleTouchMove, { passive: false });
                        videoElement.addEventListener('touchend', handleTouchEnd);
                    } else {
                        console.warn('Zoom is not supported by this camera/browser.');
                    }
                } catch (captureError) {
                    console.error('Error initializing ImageCapture:', captureError);
                }
            } else {
                console.warn('ImageCapture API not supported by this browser.');
            }
            // --- End ImageCapture setup ---

            // Enable flip button only if multiple cameras exist
            if (videoInputDevices.length > 1) {
                flipCameraBtn.disabled = false; // Enable the button
            } else {
                flipCameraBtn.disabled = true; // Keep it disabled
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

    function stopScan(keepScanningState = false) {
        console.log('Stopping scan.');
        codeReader.reset(); // Reset the decoder

        // Remove touch listeners
        videoElement.removeEventListener('touchstart', handleTouchStart);
        videoElement.removeEventListener('touchmove', handleTouchMove);
        videoElement.removeEventListener('touchend', handleTouchEnd);

        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop()); // Stop camera stream tracks
        }
        // Reset state variables
        currentStream = null;
        currentVideoTrack = null;
        currentImageCapture = null;
        currentZoomCapabilities = null;
        initialPinchDistance = 0;
        currentZoom = 1; // Reset zoom state

        videoElement.srcObject = null;
        videoElement.pause();
        videoElement.removeAttribute('src');

        // Only reset UI fully if not just flipping
        if (!keepScanningState) {
            resultElement.textContent = 'Stopped.';
            startScanBtn.style.display = 'inline-block';
            stopScanBtn.style.display = 'none';
            flipCameraBtn.disabled = true; // Disable flip button when fully stopped
            currentDeviceId = null; // Reset device ID fully when stopped
            videoInputDevices = []; // Clear device list when fully stopped
            clearError(); // Clear any previous errors
        }
    }

    // --- NEW: Flip Camera Logic ---
    function flipCamera() {
        if (videoInputDevices.length < 2 || flipCameraBtn.disabled) {
            console.warn('Flip camera called, but not available/enabled.');
            return;
        }

        // Find the index of the current device
        const currentIndex = videoInputDevices.findIndex(device => device.deviceId === currentDeviceId);
        if (currentIndex === -1) {
            console.error('Current device not found in the list. Cannot flip.');
            return; // Should not happen if logic is correct
        }

        // Calculate the index of the next device, wrapping around
        const nextIndex = (currentIndex + 1) % videoInputDevices.length;
        const nextDeviceId = videoInputDevices[nextIndex].deviceId;

        console.log(`Flipping camera from ${currentDeviceId} to ${nextDeviceId}`);

        // Stop the current scan (keeping UI state) and start with the new device
        startScan(nextDeviceId);
    }

    // Event Listeners
    startScanBtn.addEventListener('click', () => startScan()); // Initial start
    stopScanBtn.addEventListener('click', () => stopScan()); // Full stop
    flipCameraBtn.addEventListener('click', flipCamera); // Add listener for flip

    // Initial state
    resultElement.textContent = 'Click "Start Scan" to begin.';

}); 