document.addEventListener('DOMContentLoaded', () => {
    console.log('Reports.js loaded');

    // --- Element References ---
    const completedActivitiesContainer = document.getElementById('completedActivitiesListContainer');
    const addReportModal = document.getElementById('addReportModal');
    const closeAddReportModalBtn = document.getElementById('closeAddReportModalBtn');
    const addReportForm = document.getElementById('addReportForm');
    const reportDeviceTypeSelect = document.getElementById('reportDeviceType');
    const reportSerialNumberInput = document.getElementById('reportSerialNumber');
    const reportDetailsTextarea = document.getElementById('reportDetails');
    const reportPhotoInput = document.getElementById('reportPhoto');
    const photoPreviewContainer = document.getElementById('photoPreviewContainer');
    const viewReportsModal = document.getElementById('viewReportsModal');
    const closeViewReportsModalBtn = document.getElementById('closeViewReportsModalBtn');
    const closeViewReportsOkBtn = document.getElementById('closeViewReportsOkBtn');
    const reportsDisplayArea = document.getElementById('reportsDisplayArea');
    const reportActivityIdSpan = document.getElementById('reportActivityId');
    const viewReportActivityIdSpan = document.getElementById('viewReportActivityId');
    const addReportTripIdInput = document.getElementById('addReportTripId');
    const enlargedPhotoModal = document.getElementById('enlargedPhotoModal');
    const closeEnlargedPhotoModalBtn = document.getElementById('closeEnlargedPhotoModalBtn');
    const enlargedPhotoImage = document.getElementById('enlargedPhotoImage');

    // --- Database Setup ---
    let db;
    // Increment version to 5 to trigger onupgradeneeded for the new store
    const request = indexedDB.open('TripTrackerDB', 5); 

    request.onupgradeneeded = (event) => {
        db = event.target.result;
        console.log(`Reports: Upgrading database to version ${db.version}`);

        // Ensure 'trips' store exists (optional but good practice)
        if (!db.objectStoreNames.contains('trips')) {
            console.log('Reports: Creating trips store during upgrade');
            db.createObjectStore('trips', { keyPath: 'id', autoIncrement: true });
        }
        
        // --- Create the new 'reports' store ---
        if (!db.objectStoreNames.contains('reports')) {
            console.log('Reports: Creating reports store');
            const reportStore = db.createObjectStore('reports', { keyPath: 'id', autoIncrement: true });
            // Add an index to easily find reports by their parent activity ID
            reportStore.createIndex('tripId', 'tripId', { unique: false });
            console.log('Reports: Created tripId index on reports store');
        }
    };

    request.onerror = (event) => {
        console.error('Reports: Database error:', event.target.error);
        if (completedActivitiesContainer) {
            completedActivitiesContainer.innerHTML = '<p class="alert">Error loading database.</p>';
        }
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        console.log('Reports: Database opened successfully.');
        if (!db.objectStoreNames.contains('reports')) {
             console.error("Reports: Critical Error - 'reports' object store not found after setup.");
             if (completedActivitiesContainer) {
                completedActivitiesContainer.innerHTML = '<p class="alert">Error: Reports data store is missing.</p>';
             }
             return;
        }
        loadCompletedActivities();
        setupEventListeners();
    };

    // --- Functions ---

    function loadCompletedActivities() {
        if (!db) return;
        console.log('Loading completed activities...');
        completedActivitiesContainer.innerHTML = '<p class="loading-message">Loading...</p>'; // Show loading message

        const transaction = db.transaction(['trips'], 'readonly');
        const store = transaction.objectStore('trips');
        const request = store.getAll();

        request.onsuccess = () => {
            const allActivities = request.result || [];
            // Filter for completed activities (can adjust later if needed)
            const completed = allActivities.filter(act => act.status === 'completed');
            console.log('Fetched completed activities:', completed);
            displayCompletedActivities(completed);
        };

        request.onerror = (event) => {
            console.error('Error fetching activities:', event.target.error);
            completedActivitiesContainer.innerHTML = '<p class="alert">Could not load activities.</p>';
        };
    }

    function displayCompletedActivities(activities) {
        if (!activities || activities.length === 0) {
            completedActivitiesContainer.innerHTML = '<p>No completed activities found.</p>';
            return;
        }

        // Sort by date, most recent first
        activities.sort((a, b) => (b.endTime || b.startTime || '').localeCompare(a.endTime || a.startTime || ''));

        let html = `
            <table class="report-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Customer</th>
                        <th>Purpose</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        activities.forEach(act => {
            const displayDate = act.endTime ? new Date(act.endTime).toLocaleDateString() : 'N/A';
            const typeDisplay = act.type === 'travel' ? 'Travel' : (act.type === 'office' ? 'Office' : 'Unknown');
            
            html += `
                <tr>
                    <td>${displayDate}</td>
                    <td>${typeDisplay}</td>
                    <td>${act.customer || 'N/A'}</td>
                    <td>${act.purpose || 'N/A'}</td>
                    <td>
                        <button class="btn btn-small btn-add-report" data-trip-id="${act.id}">Add Details</button>
                        <button class="btn btn-small btn-view-reports" data-trip-id="${act.id}">View Reports</button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        completedActivitiesContainer.innerHTML = html;

        // Add listeners to the new buttons
        document.querySelectorAll('.btn-add-report').forEach(button => {
            button.addEventListener('click', handleAddReportClick);
        });
        document.querySelectorAll('.btn-view-reports').forEach(button => {
            button.addEventListener('click', handleViewReportsClick);
        });
    }

    function handleAddReportClick(event) {
        const tripId = event.currentTarget.dataset.tripId;
        console.log('Add report clicked for trip ID:', tripId);
        openAddReportModal(tripId);
    }

    function handleViewReportsClick(event) {
        const tripId = event.currentTarget.dataset.tripId;
        console.log('View reports clicked for trip ID:', tripId);
        openViewReportsModal(tripId);
    }

    function openAddReportModal(tripId) {
        addReportForm.reset(); // Clear previous entries
        photoPreviewContainer.innerHTML = ''; // Clear photo previews
        addReportTripIdInput.value = tripId; // Store the trip ID
        reportActivityIdSpan.textContent = tripId; // Display trip ID in title
        addReportModal.style.display = 'block';
    }

    function closeAddReportModal() {
        addReportModal.style.display = 'none';
        photoPreviewContainer.innerHTML = ''; // Clear previews on close too
    }

    function openViewReportsModal(tripId) {
        viewReportActivityIdSpan.textContent = tripId;
        reportsDisplayArea.innerHTML = '<p>Loading reports...</p>'; // Show loading state
        viewReportsModal.style.display = 'block';
        loadAndDisplayReportsForTrip(tripId); // Fetch and show reports
    }

    function closeViewReportsModal() {
        viewReportsModal.style.display = 'none';
    }

    function handlePhotoInputChange(event) {
        photoPreviewContainer.innerHTML = ''; // Clear existing previews
        const files = event.target.files;
        if (!files) return;

        for (const file of files) {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    photoPreviewContainer.appendChild(img);
                }
                reader.readAsDataURL(file); // Read file for preview
            }
        }
    }

    async function handleSaveReportSubmit(event) {
        event.preventDefault();
        console.log('Saving report details...');

        const tripId = Number(addReportTripIdInput.value);
        const deviceType = reportDeviceTypeSelect.value;
        const serialNumber = reportSerialNumberInput.value.trim();
        const details = reportDetailsTextarea.value.trim();
        const photoFiles = reportPhotoInput.files;

        if (!tripId || !details) {
            alert('Please enter Fault Report / Notes.');
            return;
        }

        const photosData = [];
        if (photoFiles && photoFiles.length > 0) {
            console.log(`Processing ${photoFiles.length} photos...`);
            await Promise.all(Array.from(photoFiles).map(file => {
                return new Promise((resolve, reject) => {
                    if (file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            photosData.push({
                                name: file.name,
                                type: file.type,
                                size: file.size,
                                dataUrl: e.target.result
                            });
                            resolve();
                        };
                        reader.onerror = (err) => {
                            console.error("FileReader error:", err);
                            reject(err);
                        };
                        reader.readAsDataURL(file);
                    } else {
                        console.warn(`Skipping non-image file: ${file.name}`);
                        resolve();
                    }
                });
            }));
            console.log('Finished processing photos.');
        }

        const reportData = {
            tripId: tripId,
            deviceType: deviceType,
            serialNumber: serialNumber,
            details: details,
            photos: photosData,
            timestamp: new Date().toISOString()
        };

        saveReportToDB(reportData, (success) => {
            if (success) {
                alert('Details saved successfully!');
                closeAddReportModal();
            } else {
                alert('Failed to save details.');
            }
        });
    }

    function saveReportToDB(reportData, callback) {
        if (!db) return callback(false);

        const transaction = db.transaction(['reports'], 'readwrite');
        const store = transaction.objectStore('reports');
        const request = store.add(reportData);

        request.onsuccess = () => {
            console.log('Report saved to DB:', reportData);
            callback(true);
        };
        request.onerror = (event) => {
            console.error('Error saving report to DB:', event.target.error);
            callback(false);
        };
    }

    function loadAndDisplayReportsForTrip(tripId) {
        if (!db) return;
        const numericTripId = Number(tripId);

        const transaction = db.transaction(['reports'], 'readonly');
        const store = transaction.objectStore('reports');
        const index = store.index('tripId'); // Use the index
        const request = index.getAll(numericTripId); // Get all reports matching the tripId

        request.onsuccess = () => {
            const reports = request.result || [];
            console.log(`Found ${reports.length} reports for trip ID ${numericTripId}:`, reports);
            displayReportsInModal(reports);
        };
        request.onerror = (event) => {
            console.error(`Error fetching reports for trip ID ${numericTripId}:`, event.target.error);
            reportsDisplayArea.innerHTML = '<p class="alert">Could not load reports.</p>';
        };
    }

    function displayReportsInModal(reports) {
        if (!reports || reports.length === 0) {
            reportsDisplayArea.innerHTML = '<p>No reports found for this activity.</p>';
            return;
        }

        reports.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));

        let html = '<ul class="reports-list">';
        reports.forEach((report, index) => {
            const reportDate = new Date(report.timestamp).toLocaleString();
            html += `<li>`;
            html += `<strong>Details added on ${reportDate}:</strong><br>`;
            if (report.deviceType) {
                html += `<p><em>Device:</em> ${report.deviceType}</p>`;
            }
            if (report.serialNumber) {
                html += `<p><em>Serial:</em> ${report.serialNumber}</p>`;
            }
            html += `<p>${report.details.replace(/\n/g, '<br>')}</p>`;

            if (report.photos && report.photos.length > 0) {
                html += `<div class="report-photos-container">`;
                report.photos.forEach((photo, photoIndex) => {
                    html += `<img src="${photo.dataUrl}" 
                                  alt="${photo.name}" 
                                  class="report-photo-thumbnail" 
                                  onclick="openEnlargedPhoto('${photo.dataUrl}')">`;
                });
                html += `</div>`;
            }
            html += `</li>`;
        });
        html += '</ul>';
        reportsDisplayArea.innerHTML = html;
    }

    window.openEnlargedPhoto = function(dataUrl) {
        if (enlargedPhotoImage && enlargedPhotoModal) {
            enlargedPhotoImage.src = dataUrl;
            enlargedPhotoModal.style.display = 'block';
        }
    }

    function closeEnlargedPhotoModal() {
        if (enlargedPhotoModal) {
            enlargedPhotoModal.style.display = 'none';
            enlargedPhotoImage.src = '';
        }
    }

    function setupEventListeners() {
        // Modal close buttons
        if (closeAddReportModalBtn) closeAddReportModalBtn.addEventListener('click', closeAddReportModal);
        if (closeViewReportsModalBtn) closeViewReportsModalBtn.addEventListener('click', closeViewReportsModal);
        if (closeViewReportsOkBtn) closeViewReportsOkBtn.addEventListener('click', closeViewReportsModal);
        if (closeEnlargedPhotoModalBtn) closeEnlargedPhotoModalBtn.addEventListener('click', closeEnlargedPhotoModal);

        // Add Report form submission
        if (addReportForm) addReportForm.addEventListener('submit', handleSaveReportSubmit);

        // Photo input change listener for previews
        if (reportPhotoInput) reportPhotoInput.addEventListener('change', handlePhotoInputChange);

        // Close modals on outside click
        window.addEventListener('click', (event) => {
            if (event.target === addReportModal) closeAddReportModal();
            if (event.target === viewReportsModal) closeViewReportsModal();
            if (event.target === enlargedPhotoModal) closeEnlargedPhotoModal();
        });
    }

}); 