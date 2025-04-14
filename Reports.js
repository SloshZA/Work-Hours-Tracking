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
    const manageReportModal = document.getElementById('manageReportModal');
    const closeManageReportModalBtn = document.getElementById('closeManageReportModalBtn');
    const manageReportActivityIdSpan = document.getElementById('manageReportActivityId');
    const manageAddDetailsBtn = document.getElementById('manageAddDetailsBtn');
    const manageViewReportsBtn = document.getElementById('manageViewReportsBtn');
    const manageCancelBtn = document.getElementById('manageCancelBtn');
    const modelFieldContainer = document.getElementById('modelFieldContainer');
    const reportModelInput = document.getElementById('reportModel');
    const descriptionFieldContainer = document.getElementById('descriptionFieldContainer');
    const reportDescriptionInput = document.getElementById('reportDescription');
    const brandFieldContainer = document.getElementById('brandFieldContainer');
    const reportBrandInput = document.getElementById('reportBrand');

    // --- State Variable ---
    let currentManageTripId = null;
    let currentManageReportId = null;
    let currentEditReport = null;

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
                        <button class="btn btn-small btn-manage-report" data-trip-id="${act.id}">Manage</button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        completedActivitiesContainer.innerHTML = html;

        // Add listeners to the new Manage buttons
        document.querySelectorAll('.btn-manage-report').forEach(button => {
            button.addEventListener('click', handleManageClick);
        });
    }

    function handleManageClick(event) {
        currentManageTripId = event.currentTarget.dataset.tripId;
        console.log('Manage report clicked for trip ID:', currentManageTripId);
        if (manageReportModal && manageReportActivityIdSpan) {
            manageReportActivityIdSpan.textContent = currentManageTripId;
            manageReportModal.style.display = 'block';
        } else {
            console.error("Manage report modal elements not found!");
        }
    }

    function closeManageReportModal() {
        if (manageReportModal) {
            manageReportModal.style.display = 'none';
        }
        currentManageTripId = null;
    }

    function openAddReportModal(tripId) {
        addReportForm.reset();
        photoPreviewContainer.innerHTML = '';
        addReportTripIdInput.value = tripId;
        reportActivityIdSpan.textContent = tripId;

        // Ensure ALL conditional fields are hidden initially
        if (modelFieldContainer) modelFieldContainer.classList.add('hidden');
        if (descriptionFieldContainer) descriptionFieldContainer.classList.add('hidden');
        if (brandFieldContainer) brandFieldContainer.classList.add('hidden');

        // Clear values
        if (reportModelInput) reportModelInput.value = '';
        if (reportDescriptionInput) reportDescriptionInput.value = '';
        if (reportBrandInput) reportBrandInput.value = '';

        // Reset Serial Number to required initially
        if (reportSerialNumberInput) reportSerialNumberInput.required = true;

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

    function handleDeviceTypeChange() {
        const selectedType = reportDeviceTypeSelect.value;

        // Hide all conditional fields by default
        if (modelFieldContainer) modelFieldContainer.classList.add('hidden');
        if (descriptionFieldContainer) descriptionFieldContainer.classList.add('hidden');
        if (brandFieldContainer) brandFieldContainer.classList.add('hidden');

        // Assume Serial Number is required unless changed
        let isSerialRequired = true;

        // Show the relevant field based on selection
        if (selectedType === 'PC' || selectedType === 'Printer') {
            if (modelFieldContainer) modelFieldContainer.classList.remove('hidden');
        } else if (selectedType === 'Other') {
            if (descriptionFieldContainer) descriptionFieldContainer.classList.remove('hidden');
        } else if (selectedType === 'Monitor') {
            if (brandFieldContainer) brandFieldContainer.classList.remove('hidden');
        } else if (selectedType === 'Network') {
            if (brandFieldContainer) brandFieldContainer.classList.remove('hidden');
            isSerialRequired = false; // Serial number is NOT required for Network Device
        }

        // Clear values of hidden fields
        if (modelFieldContainer && modelFieldContainer.classList.contains('hidden') && reportModelInput) reportModelInput.value = '';
        if (descriptionFieldContainer && descriptionFieldContainer.classList.contains('hidden') && reportDescriptionInput) reportDescriptionInput.value = '';
        if (brandFieldContainer && brandFieldContainer.classList.contains('hidden') && reportBrandInput) reportBrandInput.value = '';

        // Update the 'required' attribute on the Serial Number input
        if (reportSerialNumberInput) {
            reportSerialNumberInput.required = isSerialRequired;
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

        // Get conditional field values
        let model = '';
        let description = '';
        let brand = '';

        if (deviceType === 'PC' || deviceType === 'Printer') {
            model = reportModelInput.value.trim();
        } else if (deviceType === 'Other') {
            description = reportDescriptionInput.value.trim();
        } else if (deviceType === 'Monitor' || deviceType === 'Network') {
            brand = reportBrandInput.value.trim();
        }

        // Validation: Check required fields
        if (!tripId || !details || (reportSerialNumberInput.required && !serialNumber)) {
            let alertMessage = 'Please enter Fault Report / Notes';
            if (reportSerialNumberInput.required) {
                alertMessage += ' AND Serial Number.';
            } else {
                alertMessage += '.';
            }
            alert(alertMessage);
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
            model: model,
            description: description,
            brand: brand,
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

        reports.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

        let html = ''; 
        reports.forEach((report, index) => {
            const reportDate = new Date(report.timestamp).toLocaleDateString();
            const summary = report.deviceType ? `${report.deviceType}` : 'General Notes';
            const identifier = report.serialNumber || report.model || report.brand || report.description || `Entry ${index + 1}`;

            let identifiersHtml = '<div class="report-identifiers">';
            if (report.deviceType) {
                identifiersHtml += `<span class="report-identifier-item"><em>Device:</em> ${report.deviceType}</span>`;
            }
            if (report.model) {
                identifiersHtml += `<span class="report-identifier-item"><em>Model:</em> ${report.model}</span>`;
            }
            if (report.description) {
                identifiersHtml += `<span class="report-identifier-item"><em>Description:</em> ${report.description}</span>`;
            }
            if (report.brand) {
                identifiersHtml += `<span class="report-identifier-item"><em>Brand:</em> ${report.brand}</span>`;
            }
            if (report.serialNumber) {
                identifiersHtml += `<span class="report-identifier-item"><em>Serial:</em> ${report.serialNumber}</span>`;
            }
            identifiersHtml += '</div>';

            html += `
                <div class="report-entry">
                    <div class="report-header" data-report-index="${index}">
                        <span class="report-summary">${reportDate} - ${summary} (${identifier})</span>
                        <button class="btn btn-small btn-manage-report" data-report-id="${report.id}" style="margin-left: 10px;">Manage</button>
                        <span class="report-toggle-icon">+</span>
                    </div>
                    <div class="report-content collapsed" id="report-content-${index}">
                        ${identifiersHtml}
                        <div class="report-details-section">
                            <p><strong>Details:</strong></p>
                            <p>${report.details.replace(/\n/g, '<br>')}</p>
                        </div>
                        ${report.photos && report.photos.length > 0 ? `
                            <div class="report-photos-container">
                                ${report.photos.map(photo => `
                                    <img src="${photo.dataUrl}" 
                                         alt="${photo.name}" 
                                         class="report-photo-thumbnail" 
                                         onclick="openEnlargedPhoto('${photo.dataUrl}')">
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        
        reportsDisplayArea.innerHTML = html;
    }

    function handleReportToggle(event) {
        // Find the closest report header that was clicked
        const header = event.target.closest('.report-header');
        if (!header) return; // Exit if click wasn't on or inside a header

        // Check if the click was on the manage button
        if (event.target.closest('.btn-manage-report')) {
            return; // Exit if click was on manage button
        }

        const reportIndex = header.dataset.reportIndex;
        const content = document.getElementById(`report-content-${reportIndex}`);
        const icon = header.querySelector('.report-toggle-icon');

        if (content && icon) {
            const isCollapsed = content.classList.contains('collapsed');
            if (isCollapsed) {
                content.classList.remove('collapsed');
                icon.textContent = '−'; // Minus sign for expanded
            } else {
                content.classList.add('collapsed');
                icon.textContent = '+'; // Plus sign for collapsed
            }
        }
    }

    // MODIFIED: Open image in a new tab instead of a modal
    window.openEnlargedPhoto = function(dataUrl) {
        // Open the image data URL in a new browser tab
        window.open(dataUrl, '_blank'); 
    }

    function openManageIndividualReportModal(reportId) {
        currentManageReportId = reportId;
        const manageIndividualReportModal = document.getElementById('manageIndividualReportModal');
        if (manageIndividualReportModal) {
            manageIndividualReportModal.style.display = 'block';
        }
    }

    function closeManageIndividualReportModal() {
        const manageIndividualReportModal = document.getElementById('manageIndividualReportModal');
        if (manageIndividualReportModal) {
            manageIndividualReportModal.style.display = 'none';
        }
        currentManageReportId = null;
    }

    function handleManageReportClick(button) {
        const reportId = Number(button.dataset.reportId);
        if (!reportId) {
            console.error('Manage failed: Report ID not found on button.');
            return;
        }
        openManageIndividualReportModal(reportId);
    }

    function openEditReportModal(reportId) {
        if (!db) return;

        const transaction = db.transaction(['reports'], 'readonly');
        const store = transaction.objectStore('reports');
        const request = store.get(reportId);

        request.onsuccess = () => {
            const report = request.result;
            if (!report) {
                alert('Report not found.');
                return;
            }

            currentEditReport = report;
            const editReportModal = document.getElementById('editReportModal');
            const editReportForm = document.getElementById('editReportForm');

            // Set form values
            document.getElementById('editReportId').value = report.id;
            document.getElementById('editReportTripId').value = report.tripId;
            document.getElementById('editReportDeviceType').value = report.deviceType || '';
            document.getElementById('editReportSerialNumber').value = report.serialNumber || '';
            document.getElementById('editReportDetails').value = report.details || '';

            // Handle conditional fields
            const editModelFieldContainer = document.getElementById('editModelFieldContainer');
            const editDescriptionFieldContainer = document.getElementById('editDescriptionFieldContainer');
            const editBrandFieldContainer = document.getElementById('editBrandFieldContainer');

            // Hide all conditional fields initially
            editModelFieldContainer.classList.add('hidden');
            editDescriptionFieldContainer.classList.add('hidden');
            editBrandFieldContainer.classList.add('hidden');

            // Show and set values for relevant fields based on device type
            if (report.deviceType === 'PC' || report.deviceType === 'Printer') {
                editModelFieldContainer.classList.remove('hidden');
                document.getElementById('editReportModel').value = report.model || '';
            } else if (report.deviceType === 'Other') {
                editDescriptionFieldContainer.classList.remove('hidden');
                document.getElementById('editReportDescription').value = report.description || '';
            } else if (report.deviceType === 'Monitor' || report.deviceType === 'Network') {
                editBrandFieldContainer.classList.remove('hidden');
                document.getElementById('editReportBrand').value = report.brand || '';
            }

            // Display existing photos
            const editPhotoPreviewContainer = document.getElementById('editPhotoPreviewContainer');
            editPhotoPreviewContainer.innerHTML = '';
            if (report.photos && report.photos.length > 0) {
                report.photos.forEach(photo => {
                    const img = document.createElement('img');
                    img.src = photo.dataUrl;
                    img.alt = photo.name;
                    img.className = 'report-photo-thumbnail';
                    img.onclick = () => openEnlargedPhoto(photo.dataUrl);
                    editPhotoPreviewContainer.appendChild(img);
                });
            }

            // Show the modal
            editReportModal.style.display = 'block';
        };

        request.onerror = (event) => {
            console.error('Error fetching report:', event.target.error);
            alert('Failed to load report for editing.');
        };
    }

    function closeEditReportModal() {
        const editReportModal = document.getElementById('editReportModal');
        if (editReportModal) {
            editReportModal.style.display = 'none';
        }
        currentEditReport = null;
    }

    async function handleEditReportSubmit(event) {
        event.preventDefault();
        console.log('Saving edited report...');

        const reportId = Number(document.getElementById('editReportId').value);
        const tripId = Number(document.getElementById('editReportTripId').value);
        const deviceType = document.getElementById('editReportDeviceType').value;
        const serialNumber = document.getElementById('editReportSerialNumber').value.trim();
        const details = document.getElementById('editReportDetails').value.trim();
        const photoFiles = document.getElementById('editReportPhoto').files;

        // Get conditional field values
        let model = '';
        let description = '';
        let brand = '';

        if (deviceType === 'PC' || deviceType === 'Printer') {
            model = document.getElementById('editReportModel').value.trim();
        } else if (deviceType === 'Other') {
            description = document.getElementById('editReportDescription').value.trim();
        } else if (deviceType === 'Monitor' || deviceType === 'Network') {
            brand = document.getElementById('editReportBrand').value.trim();
        }

        // Validation: Check required fields
        if (!reportId || !tripId || !details || !serialNumber) {
            alert('Please fill in all required fields.');
            return;
        }

        const photosData = [...(currentEditReport.photos || [])];
        if (photoFiles && photoFiles.length > 0) {
            console.log(`Processing ${photoFiles.length} new photos...`);
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
            console.log('Finished processing new photos.');
        }

        const updatedReport = {
            id: reportId,
            tripId: tripId,
            deviceType: deviceType,
            model: model,
            description: description,
            brand: brand,
            serialNumber: serialNumber,
            details: details,
            photos: photosData,
            timestamp: currentEditReport.timestamp
        };

        updateReportInDB(updatedReport, (success) => {
            if (success) {
                alert('Report updated successfully!');
                closeEditReportModal();
                closeManageIndividualReportModal();
                loadAndDisplayReportsForTrip(tripId);
            } else {
                alert('Failed to update report.');
            }
        });
    }

    function updateReportInDB(reportData, callback) {
        if (!db) return callback(false);

        const transaction = db.transaction(['reports'], 'readwrite');
        const store = transaction.objectStore('reports');
        const request = store.put(reportData);

        request.onsuccess = () => {
            console.log('Report updated in DB:', reportData);
            callback(true);
        };
        request.onerror = (event) => {
            console.error('Error updating report in DB:', event.target.error);
            callback(false);
        };
    }

    function handleEditDeviceTypeChange() {
        const selectedType = document.getElementById('editReportDeviceType').value;

        // Hide all conditional fields by default
        const editModelFieldContainer = document.getElementById('editModelFieldContainer');
        const editDescriptionFieldContainer = document.getElementById('editDescriptionFieldContainer');
        const editBrandFieldContainer = document.getElementById('editBrandFieldContainer');

        editModelFieldContainer.classList.add('hidden');
        editDescriptionFieldContainer.classList.add('hidden');
        editBrandFieldContainer.classList.add('hidden');

        // Show the relevant field based on selection
        if (selectedType === 'PC' || selectedType === 'Printer') {
            editModelFieldContainer.classList.remove('hidden');
        } else if (selectedType === 'Other') {
            editDescriptionFieldContainer.classList.remove('hidden');
        } else if (selectedType === 'Monitor' || selectedType === 'Network') {
            editBrandFieldContainer.classList.remove('hidden');
        }

        // Update Serial Number requirement
        const editSerialNumberInput = document.getElementById('editReportSerialNumber');
        if (editSerialNumberInput) {
            editSerialNumberInput.required = selectedType !== 'Network';
        }
    }

    function handleEditPhotoInputChange(event) {
        const editPhotoPreviewContainer = document.getElementById('editPhotoPreviewContainer');
        const files = event.target.files;
        if (!files) return;

        for (const file of files) {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.className = 'report-photo-thumbnail';
                    editPhotoPreviewContainer.appendChild(img);
                }
                reader.readAsDataURL(file);
            }
        }
    }

    function setupEventListeners() {
        // Modal close buttons
        if (closeAddReportModalBtn) closeAddReportModalBtn.addEventListener('click', closeAddReportModal);
        if (closeViewReportsModalBtn) closeViewReportsModalBtn.addEventListener('click', closeViewReportsModal);
        if (closeViewReportsOkBtn) closeViewReportsOkBtn.addEventListener('click', closeViewReportsModal);
        if (closeManageReportModalBtn) closeManageReportModalBtn.addEventListener('click', closeManageReportModal);
        if (manageCancelBtn) manageCancelBtn.addEventListener('click', closeManageReportModal);

        // Add Report form submission
        if (addReportForm) addReportForm.addEventListener('submit', handleSaveReportSubmit);

        // Photo input change listener for previews
        if (reportPhotoInput) reportPhotoInput.addEventListener('change', handlePhotoInputChange);

        // NEW: Manage Modal Listeners
        if (closeManageReportModalBtn) closeManageReportModalBtn.addEventListener('click', closeManageReportModal);
        if (manageCancelBtn) manageCancelBtn.addEventListener('click', closeManageReportModal);
        
        // Link "Add Details" button in Manage Modal
        if (manageAddDetailsBtn) {
            manageAddDetailsBtn.addEventListener('click', () => {
                // Check if we have a valid trip ID stored
                if (currentManageTripId) { 
                    // Call the function to open the Add Report modal, passing the stored ID
                    openAddReportModal(currentManageTripId); 
                    // Close the Manage modal after opening the Add modal
                    closeManageReportModal(); 
                } else {
                    console.error("Cannot add details: No trip ID selected."); 
                }
            });
        }
        
        // Link "View Reports" button in Manage Modal
        if (manageViewReportsBtn) {
            manageViewReportsBtn.addEventListener('click', () => {
                // Check if we have a valid trip ID stored
                if (currentManageTripId) {
                    // Call the function to open the View Reports modal, passing the stored ID
                    openViewReportsModal(currentManageTripId); 
                    // Close the Manage modal after opening the View modal
                    closeManageReportModal(); 
                } else {
                    console.error("Cannot view reports: No trip ID selected.");
                }
            });
        }

        // NEW: Listener for Device Type dropdown change
        if (reportDeviceTypeSelect) {
            reportDeviceTypeSelect.addEventListener('change', handleDeviceTypeChange);
        }

        // UPDATED: Listener for report toggling AND managing within the view modal
        if (reportsDisplayArea) {
            reportsDisplayArea.addEventListener('click', (event) => {
                // Check if the click was on a manage button
                const manageButton = event.target.closest('.btn-manage-report');
                if (manageButton) {
                    handleManageReportClick(manageButton);
                    return; // Stop further processing if it was a manage button click
                }

                // Check if the click was on a toggle header
                const header = event.target.closest('.report-header');
                if (header) {
                    handleReportToggle(event);
                }
            });
        }

        // NEW: Manage Individual Report Modal Listeners
        const closeManageIndividualReportModalBtn = document.getElementById('closeManageIndividualReportModalBtn');
        const cancelManageReportBtn = document.getElementById('cancelManageReportBtn');
        const deleteReportBtn = document.getElementById('deleteReportBtn');
        const editReportBtn = document.getElementById('editReportBtn');

        if (closeManageIndividualReportModalBtn) {
            closeManageIndividualReportModalBtn.addEventListener('click', closeManageIndividualReportModal);
        }
        if (cancelManageReportBtn) {
            cancelManageReportBtn.addEventListener('click', closeManageIndividualReportModal);
        }
        if (deleteReportBtn) {
            deleteReportBtn.addEventListener('click', () => {
                if (currentManageReportId) {
                    if (confirm('Are you sure you want to delete this report entry? This action cannot be undone.')) {
                        deleteReportFromDB(currentManageReportId, (success) => {
                            if (success) {
                                const currentTripId = viewReportActivityIdSpan.textContent;
                                if (currentTripId) {
                                    loadAndDisplayReportsForTrip(currentTripId);
                                }
                                closeManageIndividualReportModal();
                            } else {
                                alert('Failed to delete the report entry. Please try again.');
                            }
                        });
                    }
                }
            });
        }
        if (editReportBtn) {
            editReportBtn.addEventListener('click', () => {
                if (currentManageReportId) {
                    openEditReportModal(currentManageReportId);
                }
            });
        }

        // NEW: Edit Report Modal Listeners
        const closeEditReportModalBtn = document.getElementById('closeEditReportModalBtn');
        const editReportForm = document.getElementById('editReportForm');
        const editReportDeviceTypeSelect = document.getElementById('editReportDeviceType');
        const editReportPhotoInput = document.getElementById('editReportPhoto');

        if (closeEditReportModalBtn) {
            closeEditReportModalBtn.addEventListener('click', closeEditReportModal);
        }
        if (editReportForm) {
            editReportForm.addEventListener('submit', handleEditReportSubmit);
        }
        if (editReportDeviceTypeSelect) {
            editReportDeviceTypeSelect.addEventListener('change', handleEditDeviceTypeChange);
        }
        if (editReportPhotoInput) {
            editReportPhotoInput.addEventListener('change', handleEditPhotoInputChange);
        }

        // Close modals on outside click
        window.addEventListener('click', (event) => {
            if (event.target === addReportModal) closeAddReportModal();
            if (event.target === viewReportsModal) closeViewReportsModal();
            if (event.target === manageReportModal) closeManageReportModal();
            if (event.target === document.getElementById('manageIndividualReportModal')) closeManageIndividualReportModal();
            if (event.target === document.getElementById('editReportModal')) closeEditReportModal();
        });
    }

}); 