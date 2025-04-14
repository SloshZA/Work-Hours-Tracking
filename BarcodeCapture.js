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
    let isScanning = false; // --- NEW: Add state flag ---

    console.log('ZXing code reader initialized');

    // --- NEW: Helper function to categorize barcode formats ---
    function getBarcodeCategory(format) {
        // ZXing.BarcodeFormat is an enum-like object provided by the library
        switch (format) {
            // 2D Formats
            case ZXing.BarcodeFormat.QR_CODE:
            case ZXing.BarcodeFormat.DATA_MATRIX:
            case ZXing.BarcodeFormat.AZTEC:
            case ZXing.BarcodeFormat.PDF_417:
            case ZXing.BarcodeFormat.MAXICODE: // Added MaxiCode as 2D
                return "2D";

            // 1D Formats
            case ZXing.BarcodeFormat.UPC_A:
            case ZXing.BarcodeFormat.UPC_E:
            case ZXing.BarcodeFormat.EAN_8:
            case ZXing.BarcodeFormat.EAN_13:
            case ZXing.BarcodeFormat.CODE_39:
            case ZXing.BarcodeFormat.CODE_93:
            case ZXing.BarcodeFormat.CODE_128:
            case ZXing.BarcodeFormat.CODABAR:
            case ZXing.BarcodeFormat.ITF: // Interleaved 2 of 5
            case ZXing.BarcodeFormat.RSS_14: // Now GS1 DataBar
            case ZXing.BarcodeFormat.RSS_EXPANDED: // Now GS1 DataBar Expanded
                return "1D";

            // Other/Unknown
            default:
                return "Unknown";
        }
    }
    // --- End NEW Helper ---

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
        // --- NEW: Check if already scanning ---
        if (isScanning) {
            console.log('Scan already in progress.');
            return;
        }
        isScanning = true; // Set flag immediately
        // --- End NEW Check ---

        clearError();
        resultElement.textContent = 'Starting camera...';
        startScanBtn.disabled = true; // Disable button immediately
        startScanBtn.style.display = 'none';
        stopScanBtn.style.display = 'inline-block';
        stopScanBtn.disabled = false; // Ensure stop button is enabled

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
                const decodePromise = codeReader.decodeFromVideoDevice(selectedDeviceId, videoElement, (result, err) => {
                    // --- Ensure we are still scanning before processing ---
                    if (!isScanning) return;
                    // --- End Check ---

                    if (result) {
                        // --- MODIFIED: Add more detailed logging ---
                        console.log('Barcode found (Full Result):', result); // Log the whole result object
                        // --- End MODIFICATION ---

                        const format = result.getBarcodeFormat();
                        const formatName = ZXing.BarcodeFormat[format]; // Get string name from enum value
                        const category = getBarcodeCategory(format); // Get the category
                        const data = result.getText();

                        resultElement.textContent = `Format: ${formatName} (${category})\nData: ${data}`;

                        if (navigator.vibrate) {
                            navigator.vibrate(100); // Vibrate for 100ms
                        }
                    }

                    // --- MODIFIED: Log all errors temporarily for debugging ---
                    if (err) {
                        // Log ALL errors, including NotFoundException, to see what's happening frame-by-frame
                        console.log('Decoding attempt error:', err); // Use console.log to avoid spamming console.error for NotFound
                        if (!(err instanceof ZXing.NotFoundException)) {
                            // Log non-NotFound errors more prominently if needed
                            console.error('Significant decoding error:', err);
                            // Maybe update UI slightly on non-NotFound errors?
                            // resultElement.textContent = 'Error during scan. Check console.';
                        }
                    }
                    // --- End MODIFICATION ---

                    // Keep scanning... resultElement might show "Scanning..." if no barcode found yet
                    if (!result && resultElement.textContent.startsWith('Accessing')) {
                         resultElement.textContent = 'Scanning... Point camera at a barcode.';
                    }
                });

                // Get the stream from the promise (though decodeFromVideoDevice might not expose it directly this way)
                // It's safer to rely on codeReader.reset() to handle stream stopping.

            })
            .catch((err) => {
                console.error('Error during scan setup:', err);
                showError(`Setup Error: ${err.message}. Please ensure permissions are granted.`);
                stopScan(); // Ensure UI resets and flag is cleared on setup error
            });
    }

    function stopScan() {
        // --- NEW: Check if actually scanning ---
        if (!isScanning) {
            // console.log('Not currently scanning, stopScan ignored.');
            // return; // Allow resetting UI even if flag is somehow false
        }
        // --- End NEW Check ---

        console.log('Stopping scan.');
        isScanning = false; // Clear flag
        codeReader.reset(); // Reset the decoder (this should stop the stream)

        // Explicitly clear video source just in case reset doesn't handle it immediately
        if (videoElement.srcObject) {
            videoElement.srcObject.getTracks().forEach(track => track.stop());
        }
        videoElement.srcObject = null;
        videoElement.pause();
        videoElement.removeAttribute('src');
        videoElement.load(); // Attempt to reset video state

        resultElement.textContent = 'Stopped.';
        startScanBtn.disabled = false; // Re-enable start button
        stopScanBtn.disabled = true; // Disable stop button
        startScanBtn.style.display = 'inline-block';
        stopScanBtn.style.display = 'none';
    }

    // Event Listeners
    startScanBtn.addEventListener('click', startScan);
    stopScanBtn.addEventListener('click', stopScan);

    // Initial state
    resultElement.textContent = 'Click "Start Scan" to begin.';
    stopScanBtn.disabled = true; // Ensure stop is disabled initially

}); 