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

            // Build the inline identifier string conditionally
            let identifiersHtml = '<div class="report-identifiers">'; // Container for inline items
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
            identifiersHtml += '</div>'; // Close container

            html += `
                <div class="report-entry">
                    <div class="report-header" data-report-index="${index}">
                        <span class="report-summary">${reportDate} - ${summary} (${identifier})</span>
                        <button class="btn btn-danger btn-small btn-delete-report" data-report-id="${report.id}" style="margin-left: 10px;">Delete</button> 
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

    // NEW: Handle Delete Report Button Click
    function handleDeleteReportClick(button) {
        const reportId = Number(button.dataset.reportId);
        if (!reportId) {
            console.error('Delete failed: Report ID not found on button.');
            return;
        }

        if (confirm('Are you sure you want to delete this report entry? This action cannot be undone.')) {
            console.log(`Attempting to delete report with ID: ${reportId}`);
            deleteReportFromDB(reportId, (success) => {
                if (success) {
                    console.log(`Report ${reportId} deleted successfully.`);
                    // Refresh the reports list in the modal
                    const currentTripId = viewReportActivityIdSpan.textContent; 
                    if (currentTripId) {
                        loadAndDisplayReportsForTrip(currentTripId);
                    } else {
                        console.error("Could not refresh reports: Trip ID not found.");
                        // Optionally close and reopen modal or show message
                        reportsDisplayArea.innerHTML = '<p class="alert">Report deleted. Please close and reopen to see changes.</p>';
                    }
                } else {
                    console.error(`Failed to delete report ${reportId}.`);
                    alert('Failed to delete the report entry. Please try again.');
                }
            });
        } else {
            console.log('Report deletion cancelled by user.');
        }
    }

    // NEW: Delete Report from IndexedDB
    function deleteReportFromDB(reportId, callback) {
        if (!db) {
            console.error("Database not available for deletion.");
            return callback(false);
        }

        const transaction = db.transaction(['reports'], 'readwrite');
        const store = transaction.objectStore('reports');
        const request = store.delete(reportId);

        request.onsuccess = () => {
            console.log(`Successfully initiated deletion for report ID: ${reportId}`);
            callback(true);
        };
        request.onerror = (event) => {
            console.error(`Error deleting report ID ${reportId}:`, event.target.error);
            callback(false);
        };
        transaction.oncomplete = () => {
             console.log(`Transaction completed for deleting report ID: ${reportId}`);
        };
        transaction.onerror = (event) => {
             console.error(`Transaction error during deletion for report ID ${reportId}:`, event.target.error);
             // Callback might have already been called with false in request.onerror
        };
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

        // UPDATED: Listener for report toggling AND deleting within the view modal
        if (reportsDisplayArea) {
            reportsDisplayArea.addEventListener('click', (event) => {
                // Check if the click was on a toggle header
                const header = event.target.closest('.report-header');
                if (header) {
                    handleReportToggle(event);
                    return; // Stop further processing if it was a toggle click
                }

                // Check if the click was on a delete button
                const deleteButton = event.target.closest('.btn-delete-report');
                if (deleteButton) {
                    handleDeleteReportClick(deleteButton);
                }
            });
        }

        // Close modals on outside click
        window.addEventListener('click', (event) => {
            if (event.target === addReportModal) closeAddReportModal();
            if (event.target === viewReportsModal) closeViewReportsModal();
            if (event.target === manageReportModal) closeManageReportModal(); 
        });
    }

}); 