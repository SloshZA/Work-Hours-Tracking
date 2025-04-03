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

    function startScan() {
        clearError();
        resultElement.textContent = 'Starting camera...';
        startScanBtn.style.display = 'none';
        stopScanBtn.style.display = 'inline-block';

        // Get video input devices
        codeReader.listVideoInputDevices()
            .then((videoInputDevices) => {
                if (videoInputDevices.length === 0) {
                    throw new Error('No camera devices found.');
                }

                // Prefer back camera if available
                const backCamera = videoInputDevices.find(device => /back|environment/i.test(device.label));
                selectedDeviceId = backCamera ? backCamera.deviceId : videoInputDevices[0].deviceId;

                console.log(`Using video device: ${selectedDeviceId}`);
                resultElement.textContent = 'Accessing camera...';

                // Start decoding from the selected device
                codeReader.decodeFromVideoDevice(selectedDeviceId, videoElement, (result, err) => {
                    if (result) {
                        console.log('Barcode found:', result);
                        resultElement.textContent = `Format: ${result.getBarcodeFormat()}\nData: ${result.getText()}`;
                        // Optional: Stop scanning after first successful read
                        // stopScan();
                        // Optional: Vibrate on success
                        if (navigator.vibrate) {
                            navigator.vibrate(100); // Vibrate for 100ms
                        }
                    }
                    if (err && !(err instanceof ZXing.NotFoundException)) {
                        // Ignore NotFoundException as it's expected when no barcode is in view
                        console.error('Decoding error:', err);
                        // Don't show error for continuous scanning, just log it
                        // showError(`Scanning Error: ${err.message}`);
                        // stopScan(); // Stop on other errors
                    }
                    // Keep scanning... resultElement might show "Scanning..." if no barcode found yet
                    if (!result && resultElement.textContent.startsWith('Accessing')) {
                         resultElement.textContent = 'Scanning... Point camera at a barcode.';
                    }
                }).catch((err) => {
                    console.error('Error starting video stream:', err);
                    showError(`Camera Error: ${err.message}. Please ensure permissions are granted.`);
                    stopScan(); // Ensure UI resets on error
                });
            })
            .catch((err) => {
                console.error('Error listing video devices:', err);
                showError(`Device Error: ${err.message}`);
                stopScan(); // Ensure UI resets on error
            });
    }

    function stopScan() {
        console.log('Stopping scan.');
        codeReader.reset(); // Reset the decoder
        if (stream) {
            stream.getTracks().forEach(track => track.stop()); // Stop camera stream tracks
            stream = null; // Clear the stream variable
        }
        videoElement.srcObject = null; // Detach stream from video element
        videoElement.pause();
        videoElement.removeAttribute('src'); // Clean up video source

        resultElement.textContent = 'Stopped.';
        startScanBtn.style.display = 'inline-block';
        stopScanBtn.style.display = 'none';
    }

    // Event Listeners
    startScanBtn.addEventListener('click', startScan);
    stopScanBtn.addEventListener('click', stopScan);

    // Initial state
    resultElement.textContent = 'Click "Start Scan" to begin.';

}); 