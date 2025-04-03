let db;
// Use a single variable/key for any active activity
let activeActivityData = null;
const ACTIVE_ACTIVITY_KEY = 'activeActivityData';

// --- Modal Handling (Add End Trip Modal elements) ---
const startTripModal = document.getElementById('startTripModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const startTripForm = document.getElementById('startTripForm');
const modalStartKmInput = document.getElementById('modalStartKm');
const modalCustomerSelect = document.getElementById('modalCustomer');
const modalPurposeInput = document.getElementById('modalPurpose');
const modalVehicleDisplay = document.getElementById('modalVehicleDisplay');

// End Trip Modal Elements
const endTripModal = document.getElementById('endTripModal');
const closeEndModalBtn = document.getElementById('closeEndModalBtn');
const endTripForm = document.getElementById('endTripForm');
const modalEndKmInput = document.getElementById('modalEndKm');
const modalWorkDetailsInput = document.getElementById('modalWorkDetails');
const completeTripBtn = document.getElementById('completeTripBtn'); // Button on main page

// --- NEW: Add references for new modal elements ---
const startChoiceModal = document.getElementById('startChoiceModal');
const closeStartChoiceModalBtn = document.getElementById('closeStartChoiceModalBtn');
const startTravelBtn = document.getElementById('startTravelBtn');
const startOfficeBtn = document.getElementById('startOfficeBtn');
const startChoiceCancelBtn = document.getElementById('startChoiceCancelBtn');

const officeEntryModal = document.getElementById('officeEntryModal');
const closeOfficeEntryModalBtn = document.getElementById('closeOfficeEntryModalBtn');
const officeEntryForm = document.getElementById('officeEntryForm');
const officeCustomerSelect = document.getElementById('officeCustomerSelect');
const officeWorkDetails = document.getElementById('officeWorkDetails');
const saveOfficeEntryBtn = document.getElementById('saveOfficeEntryBtn');
const officePurposeInput = document.getElementById('officePurpose'); // Add purpose input

// --- NEW: Work Reminder Modal Elements ---
const workReminderModal = document.getElementById('workReminderModal');
const closeReminderModalBtn = document.getElementById('closeReminderModalBtn');
const workReminderForm = document.getElementById('workReminderForm');
const reminderCustomerSelect = document.getElementById('reminderCustomerSelect');
const reminderPurposeInput = document.getElementById('reminderPurposeInput');
const reminderDateInput = document.getElementById('reminderDateInput');
const saveReminderBtn = document.getElementById('saveReminderBtn'); // Optional, if needed later
const workReminderBtn = document.getElementById('workReminderBtn'); // The button that opens the modal

// --- References for Active Displays ---
const activeTripInfoDiv = document.getElementById('activeTripInfo');
const activeTripDetailsDiv = document.getElementById('activeTripDetails');
const activeOfficeInfoDiv = document.getElementById('activeOfficeInfo');
const activeOfficeDetailsDiv = document.getElementById('activeOfficeDetails');
const editOfficeWorkBtn = document.getElementById('editOfficeWorkBtn');
const completeOfficeWorkBtn = document.getElementById('completeOfficeWorkBtn');
const editTripBtn = document.getElementById('editTripBtn'); // Add reference for the new button

// At the top of the file where other elements are defined
const deleteOfficeWorkBtn = document.getElementById('deleteOfficeWorkBtn');
const deleteTripBtn = document.getElementById('deleteTripBtn');

const request = indexedDB.open('TripTrackerDB', 4);

request.onupgradeneeded = (event) => {
    db = event.target.result;
    console.log(`Upgrading database to version ${db.version}`); // Add log
    if (!db.objectStoreNames.contains('trips')) {
        console.log('Creating trips store');
        db.createObjectStore('trips', { keyPath: 'id', autoIncrement: true });
    }
    if (!db.objectStoreNames.contains('customers')) {
        console.log('Creating customers store');
        const customerStore = db.createObjectStore('customers', { keyPath: 'id', autoIncrement: true });
        if (!customerStore.indexNames.contains('name')) {
             console.log('Creating name index on customers store');
             customerStore.createIndex('name', 'name', { unique: false });
        }
    }
    if (!db.objectStoreNames.contains('vehicles')) {
        console.log('Creating vehicles store');
        const vehicleStore = db.createObjectStore('vehicles', { keyPath: 'id', autoIncrement: true });
         if (!vehicleStore.indexNames.contains('name')) {
             console.log('Creating name index on vehicles store');
             vehicleStore.createIndex('name', 'name', { unique: true });
         }
    } else {
        // If store exists, ensure index exists (needed if upgrading)
        const transaction = event.target.transaction; // Get transaction from event
        const vehicleStore = transaction.objectStore('vehicles');
        if (!vehicleStore.indexNames.contains('name')) {
             console.log('Creating name index on existing vehicles store');
             vehicleStore.createIndex('name', 'name', { unique: true });
        }
    }
    if (!db.objectStoreNames.contains('preferences')) {
        console.log('Creating preferences store');
        db.createObjectStore('preferences', { keyPath: 'id' });
    }
    // --- Add reminders store if not already present ---
    if (!db.objectStoreNames.contains('reminders')) {
        console.log('Creating reminders store');
        const reminderStore = db.createObjectStore('reminders', { keyPath: 'id', autoIncrement: true });
        // Optional: Add indexes if needed for querying later (e.g., by date)
        // reminderStore.createIndex('reminderDate', 'reminderDate', { unique: false });
        // reminderStore.createIndex('customer', 'customer', { unique: false });
    }
};

request.onsuccess = (event) => {
    db = event.target.result;
    console.log('Database opened successfully');
    
    // Add default vehicle if it doesn't exist
    addDefaultVehicleIfNeeded(); // Call the new function
    
    // --- MODIFIED: Check for any active activity ---
    const storedActivity = localStorage.getItem(ACTIVE_ACTIVITY_KEY);
    if (storedActivity) {
        try {
            activeActivityData = JSON.parse(storedActivity);
            console.log('Restored active activity from localStorage:', activeActivityData);
            if (activeActivityData.type === 'travel') {
                displayActiveTripInfo(activeActivityData);
            } else if (activeActivityData.type === 'office') {
                displayActiveOfficeInfo(activeActivityData);
            }
            // Hide the start button if any activity is active
            const startActivityButton = document.getElementById('saveTripBtn');
            if (startActivityButton) {
                startActivityButton.style.display = 'none';
            }
        } catch (e) {
            console.error('Error parsing stored active activity data:', e);
            localStorage.removeItem(ACTIVE_ACTIVITY_KEY);
            activeActivityData = null; // Clear the variable
        }
    }
    
    // Load and set the last used user
    const userSelect = document.getElementById('userSelect');
    if (userSelect) {
        getPreference('lastUser', (lastUser) => {
            if (lastUser && userSelect.querySelector(`option[value="${lastUser}"]`)) {
                userSelect.value = lastUser;
                console.log('Set user dropdown to last used:', lastUser);
            } else {
                console.log('No valid lastUser preference found.');
                // Optionally set to a default value if needed
                // userSelect.value = ""; // Or the first user, etc.
            }
        });
    } else {
        console.warn('User select element (#userSelect) not found.');
    }
    
    populateVehicleDropdown();
    setupEventListeners();
};

request.onerror = (event) => {
    console.error('Error opening database:', event.target.error);
};

function saveTrip(trip, onSuccessCallback) {
    const transaction = db.transaction(['trips'], 'readwrite');
    const store = transaction.objectStore('trips');
    const request = store.add(trip);

    request.onsuccess = () => {
        console.log('Trip saved successfully to DB:', trip);
        // Alert moved to the specific handlers (start/end)
        if (onSuccessCallback) {
            onSuccessCallback(request.result); // Pass back the generated ID if needed
        }
        // Update vehicle preference only when starting? Or always? Let's keep it here.
    if (trip.vehicle) {
        savePreference('lastVehicle', trip.vehicle);
        }
    };
    
    request.onerror = (event) => {
        console.error('Error saving trip to DB:', event.target.error);
        alert('Error saving trip data.');
    };
}

function getTrips(callback) {
    const transaction = db.transaction(['trips'], 'readonly');
    const store = transaction.objectStore('trips');
    const request = store.getAll();

    request.onsuccess = () => {
        callback(request.result);
    };
}

function saveCustomer(customer) {
    const transaction = db.transaction(['customers'], 'readwrite');
    const store = transaction.objectStore('customers');
    store.add(customer);
}

function getCustomers(callback) {
    if (!db) {
        console.error('DB not ready for getCustomers');
        callback([]);
        return;
    }
    const transaction = db.transaction(['customers'], 'readonly');
    const store = transaction.objectStore('customers');
    const request = store.getAll();

    request.onsuccess = () => {
        callback(request.result || []);
    };
    request.onerror = (event) => {
        console.error('Error getting customers:', event.target.error);
        callback([]);
    };
}

function saveVehicle(vehicle) {
    const transaction = db.transaction(['vehicles'], 'readwrite');
    const store = transaction.objectStore('vehicles');
    store.add(vehicle);
}

function getVehicles(callback) {
    if (!db) {
        console.error('DB not ready for getVehicles');
        callback([]);
        return;
    }
    const transaction = db.transaction(['vehicles'], 'readonly');
    const store = transaction.objectStore('vehicles');
    const request = store.getAll();

    request.onsuccess = () => {
        callback(request.result || []);
    };
    request.onerror = (event) => {
        console.error('Error getting vehicles:', event.target.error);
        callback([]);
    };
}

function savePreference(key, value) {
    const transaction = db.transaction(['preferences'], 'readwrite');
    const store = transaction.objectStore('preferences');
    
    const preference = {
        id: key,
        value: value
    };
    
    const request = store.put(preference);
    request.onsuccess = () => {
        console.log(`Preference saved: ${key} = ${value}`);
    };
    
    request.onerror = (event) => {
        console.error(`Error saving preference ${key}:`, event.target.error);
    };
}

function getPreference(key, callback) {
    if (!db) {
        console.error('Database not available');
        if (callback) callback(null);
        return;
    }
    
    try {
        const transaction = db.transaction(['preferences'], 'readonly');
        const store = transaction.objectStore('preferences');
        const request = store.get(key);
        
        request.onsuccess = () => {
            const result = request.result ? request.result.value : null;
            console.log(`Retrieved preference ${key}:`, result);
            if (callback) callback(result);
        };
        
        request.onerror = (event) => {
            console.error(`Error getting preference ${key}:`, event.target.error);
            if (callback) callback(null);
        };
    } catch (error) {
        console.error(`Exception getting preference ${key}:`, error);
        if (callback) callback(null);
    }
}

// Load vehicles into dropdown
function populateVehicleDropdown() {
    const vehicleSelect = document.getElementById('vehicleSelect');
    if (!vehicleSelect) {
        console.warn('Vehicle select element not found');
        return;
    }
    
    getVehicles((vehicles) => {
        console.log('Populating vehicles:', vehicles);
        vehicleSelect.innerHTML = '<option value="">-- Select Vehicle --</option>'; // Clear existing options
        
        if (vehicles && vehicles.length > 0) {
            vehicles.forEach(vehicle => {
                const option = document.createElement('option');
                option.value = vehicle.name;
                option.textContent = `${vehicle.name} (${vehicle.currentKm || 0} KM)`; // Display KM in dropdown
                option.dataset.currentKm = vehicle.currentKm || '0'; // Store KM in data attribute
                vehicleSelect.appendChild(option);
            });
            
            getPreference('lastVehicle', (lastVehicle) => {
                if (lastVehicle && vehicleSelect.querySelector(`option[value="${lastVehicle}"]`)) {
                        vehicleSelect.value = lastVehicle;
                    console.log('Set vehicle dropdown to last used:', lastVehicle);
                } else {
                    console.log('No valid lastVehicle preference found or vehicle deleted.');
                }
            });
        } else {
            console.log('No vehicles found in database to populate dropdown.');
        }
    });
}

// --- Modify populateCustomerDropdown to accept a callback ---
function populateCustomerDropdown(selectElementId, callback) { // Add callback parameter
    const customerSelect = document.getElementById(selectElementId);
    if (!customerSelect) {
        console.error(`Customer select element with ID ${selectElementId} not found.`);
        if (callback) callback(); // Call callback even on error to prevent blocking
        return;
    }

    getCustomers((customers) => {
        console.log(`Populating customers for #${selectElementId}:`, customers);
        // Keep the default option
        customerSelect.innerHTML = '<option value="">-- Select Customer --</option>';

        if (customers && customers.length > 0) {
            // Sort customers alphabetically
            customers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            customers.forEach(customer => {
                const option = document.createElement('option');
                option.value = customer.name;
                option.textContent = customer.name;
                customerSelect.appendChild(option);
            });
        } else {
            console.log('No customers found in database.');
        }

        // Execute the callback function after populating
        if (callback) {
            callback();
        }
    });
}

// --- Modal Handling ---

// Start Trip Modal (Travel) - Modified to handle editing
function openStartTripModal(isEditing = false) {
    const vehicleSelect = document.getElementById('vehicleSelect');
    const startTripSubmitBtn = startTripForm.querySelector('button[type="submit"]'); // Get submit button

    let vehicleName = '';
    let currentKm = '';
    let customerToSelect = '';
    let purposeToSet = '';

    if (isEditing && activeActivityData && activeActivityData.type === 'travel') {
        // Editing existing trip
        vehicleName = activeActivityData.vehicle;
        currentKm = activeActivityData.startKm.toString(); // Use stored start KM
        customerToSelect = activeActivityData.customer;
        purposeToSet = activeActivityData.purpose;
        if (startTripSubmitBtn) startTripSubmitBtn.textContent = 'Update Trip';
        modalStartKmInput.readOnly = true; // Make Start KM read-only when editing
        modalVehicleDisplay.textContent = vehicleName; // Display vehicle name
    } else {
        // Starting new trip
        const selectedOption = vehicleSelect.options[vehicleSelect.selectedIndex];
        if (!selectedOption || !selectedOption.value) {
            alert('Please select a vehicle first.');
            return;
        }
        vehicleName = selectedOption.value;
        currentKm = selectedOption.dataset.currentKm || '0';
        if (startTripSubmitBtn) startTripSubmitBtn.textContent = 'Start Trip'; // Reset button text
        modalStartKmInput.readOnly = false; // Make Start KM editable for new trip
        modalVehicleDisplay.textContent = vehicleName; // Display vehicle name
    }

    // Populate modal fields
    modalStartKmInput.value = currentKm;
    modalPurposeInput.value = purposeToSet; // Set purpose (empty if new)

    // Populate customers AND display modal in the callback
    populateCustomerDropdown('modalCustomer', () => {
        // This callback runs AFTER the dropdown is populated
        if (isEditing && customerToSelect) {
            modalCustomerSelect.value = customerToSelect; // Select the customer
            console.log(`Set travel modal customer dropdown to: ${customerToSelect}`);
        } else {
            modalCustomerSelect.value = ''; // Ensure customer is cleared for new trip
        }
        startTripModal.style.display = 'block'; // Display modal now
        console.log(`Start trip modal displayed. Editing: ${isEditing}`);
    });
}

function closeStartTripModal() {
    if (startTripModal) {
        startTripModal.style.display = 'none';
        // Reset button text on close
        const startTripSubmitBtn = startTripForm.querySelector('button[type="submit"]');
        if (startTripSubmitBtn) startTripSubmitBtn.textContent = 'Start Trip';
        modalStartKmInput.readOnly = false; // Ensure KM field is editable next time
    }
}

// Modified to handle both starting and updating a trip
function handleStartTripFormSubmit(event) {
    event.preventDefault();

    const customer = modalCustomerSelect.value;
    const purpose = modalPurposeInput.value;
    const userSelect = document.getElementById('userSelect');
    const user = userSelect ? userSelect.value : 'Unknown';

    if (!user) {
        alert('Please select a user.');
        return;
    }
    if (!customer || !purpose) {
        alert('Please fill in Customer and Purpose.');
        return;
    }

    // Check if we are updating an existing active travel trip
    if (activeActivityData && activeActivityData.type === 'travel') {
        console.log('Updating active travel trip...');
        const updatedTripData = {
            ...activeActivityData, // Keep original startTime, vehicle, startKm, status, type
            customer: customer,
            purpose: purpose,
            user: user, // Update user in case it changed
        };

        activeActivityData = updatedTripData;
        try {
            localStorage.setItem(ACTIVE_ACTIVITY_KEY, JSON.stringify(activeActivityData));
            console.log('Active travel data updated in localStorage.');
            savePreference('lastUser', user); // Save user preference

            displayActiveTripInfo(activeActivityData); // Update the display
            closeStartTripModal();
            alert('Trip details updated successfully!');

        } catch (e) {
            console.error('Error updating active travel data in localStorage:', e);
            alert('Could not update trip data locally. Please try again.');
            // Optionally revert activeActivityData if save fails? For now, leave it.
        }

    } else {
        // --- Starting a NEW travel trip ---
        const vehicleName = modalVehicleDisplay.textContent;
        const startKm = modalStartKmInput.value;

        if (!vehicleName || !startKm) {
            alert('Vehicle or Start KM is missing.'); // Should not happen if modal opened correctly
            return;
        }

        const trip = {
            startKm: parseInt(startKm),
            customer,
            purpose,
            vehicle: vehicleName,
            startTime: new Date().toISOString(),
            status: 'active',
            user: user,
            type: 'travel'
        };

        console.log('New travel activity started:', trip);

        activeActivityData = trip;
        try {
            localStorage.setItem(ACTIVE_ACTIVITY_KEY, JSON.stringify(activeActivityData));
            console.log('Active travel data saved to localStorage.');
            savePreference('lastUser', user);
            savePreference('lastVehicle', vehicleName); // Save vehicle preference on start

            displayActiveTripInfo(trip);
            closeStartTripModal();

            const startActivityButton = document.getElementById('saveTripBtn');
            if (startActivityButton) {
                startActivityButton.style.display = 'none';
            }
        } catch (e) {
            console.error('Error saving active travel data to localStorage:', e);
            alert('Could not save activity data locally. Please try again.');
            activeActivityData = null; // Clear if save failed
            localStorage.removeItem(ACTIVE_ACTIVITY_KEY);
            const startActivityButton = document.getElementById('saveTripBtn');
            if (startActivityButton) startActivityButton.style.display = 'block'; // Show start button again
        }
    }
}

// End Trip Modal - No changes needed
function openEndTripModal() {
    if (!activeActivityData) {
        alert('No active trip found!');
        return;
    }
    // Clear previous entries
    modalEndKmInput.value = '';
    modalWorkDetailsInput.value = '';
    // Pre-fill end KM if possible? Maybe based on last trip? For now, leave blank.
    // modalEndKmInput.value = activeTripData.startKm; // Example prefill (likely incorrect)

    if (endTripModal) {
        endTripModal.style.display = 'block';
    }
}

function closeEndTripModal() {
    if (endTripModal) {
        endTripModal.style.display = 'none';
    }
}

function handleEndTripFormSubmit(event) {
    event.preventDefault();
    if (!activeActivityData || activeActivityData.type !== 'travel') { // Check type
        alert('Error: No active travel trip data found.');
        closeEndTripModal();
        return;
    }

    const endKm = modalEndKmInput.value;
    const workDetails = modalWorkDetailsInput.value;

    if (!endKm) {
        alert('Please enter the End KM.');
        return;
    }

    const endKmValue = parseInt(endKm);
    if (isNaN(endKmValue) || endKmValue < activeActivityData.startKm) {
        alert('End KM must be a number and greater than or equal to Start KM.');
        return;
    }

    const completedTrip = {
        ...activeActivityData,
        endKm: endKmValue,
        workDetails: workDetails || '',
        endTime: new Date().toISOString(),
        status: 'completed',
        date: activeActivityData.startTime
    };

    console.log('Attempting to save completed travel trip:', completedTrip);

    saveTrip(completedTrip, (success) => {
        if (success) {
        alert('Trip completed and saved successfully!');

        // Clear local state
            activeActivityData = null;
            localStorage.removeItem(ACTIVE_ACTIVITY_KEY);

        // Update UI
            if (activeTripInfoDiv) activeTripInfoDiv.style.display = 'none';
            const startActivityButton = document.getElementById('saveTripBtn');
            if (startActivityButton) startActivityButton.style.display = 'block';

            closeEndTripModal();
            updateVehicleKm(completedTrip.vehicle, completedTrip.endKm);
            populateVehicleDropdown();
        } else {
             alert('Failed to save completed trip.');
        }
    });
}

// --- NEW: Start Choice Modal Functions ---
function openStartChoiceModal() {
    if (startChoiceModal) {
        startChoiceModal.style.display = 'block';
    }
}

function closeStartChoiceModal() {
    if (startChoiceModal) {
        startChoiceModal.style.display = 'none';
    }
}

// --- NEW: Office Entry Modal Functions ---
function openOfficeEntryModal(isEditing = false) {
    if (officeEntryModal) {
        let customerToSelect = ''; // Variable to hold the customer name

        if (isEditing && activeActivityData && activeActivityData.type === 'office') {
            // Store the customer to select later
            customerToSelect = activeActivityData.customer || '';
            // Pre-fill other fields immediately
            officePurposeInput.value = activeActivityData.purpose || '';
            officeWorkDetails.value = activeActivityData.workDetails || '';
            saveOfficeEntryBtn.textContent = 'Update Office Entry';
        } else {
            // Clear form for new entry
            officeCustomerSelect.value = ''; // Clear selection immediately
            officePurposeInput.value = '';
            officeWorkDetails.value = '';
            saveOfficeEntryBtn.textContent = 'Start Work';
        }

        // Populate dropdown and set value in callback
        populateCustomerDropdown('officeCustomerSelect', () => {
            // This runs after options are added
            if (isEditing && customerToSelect) {
                officeCustomerSelect.value = customerToSelect;
                console.log(`Set office modal customer dropdown to: ${customerToSelect}`);
            }
             // Ensure the modal is displayed after population/selection attempt
             officeEntryModal.style.display = 'block';
        });

        // Note: We moved the display:block into the callback to ensure
        // the dropdown is fully ready before showing the modal.
        // If this causes issues, we can move it back out, but the selection
        // might visually "jump" if the population takes a moment.
    }
}

function closeOfficeEntryModal() {
    if (officeEntryModal) {
        officeEntryModal.style.display = 'none';
        // Reset button text on close to the default for a new entry
        saveOfficeEntryBtn.textContent = 'Start Work'; // Changed reset text
    }
}

function handleSaveOfficeEntry(event) {
    event.preventDefault();

    // --- Add logging here ---
    console.log('handleSaveOfficeEntry called. Current activeActivityData:', JSON.stringify(activeActivityData));
    // --- End logging ---

    const customer = officeCustomerSelect.value;
    const purpose = officePurposeInput.value.trim(); // Get purpose
    const workDetails = officeWorkDetails.value.trim();
    const userSelect = document.getElementById('userSelect');
    const user = userSelect ? userSelect.value : 'Unknown';

    if (!user) {
        alert('Please select a user.');
        return;
    }
    if (!customer) {
        alert('Please select a customer.');
        return;
    }
    if (!purpose) {
        alert('Please enter a purpose.');
        return;
    }

    const now = new Date().toISOString();
    let officeEntryData;

    if (activeActivityData && activeActivityData.type === 'office') {
        // --- Add logging here ---
        console.log('Entering EDITING block for office work.');
        // --- End logging ---

        // --- Editing existing active office work ---
        if (!workDetails) {
            alert('Please enter work details when editing.');
            return; // This is likely where the alert is coming from
        }
        console.log('Updating active office entry...');
        officeEntryData = {
            ...activeActivityData, // Keep original startTime, user, type etc.
            customer: customer,
            purpose: purpose,
            workDetails: workDetails,
            user: user,
        };
    } else {
        // --- Add logging here ---
        console.log('Entering CREATING block for office work.');
        // --- End logging ---

        // --- Creating new active office work ---
        console.log('Starting new office entry...');
        officeEntryData = {
            user: user,
            customer: customer,
            purpose: purpose,
            workDetails: workDetails, // Save it even if empty
            startTime: now,
            date: now,
            status: 'active',
            type: 'office',
            vehicle: null,
            startKm: null,
            endKm: null
        };
    }

    // Store in global variable and localStorage
    activeActivityData = officeEntryData;
    try {
        localStorage.setItem(ACTIVE_ACTIVITY_KEY, JSON.stringify(activeActivityData));
        console.log('Active office data saved/updated in localStorage.');
        savePreference('lastUser', user); // Save user preference

        displayActiveOfficeInfo(activeActivityData); // Display the active office info
        closeOfficeEntryModal();

        const startActivityButton = document.getElementById('saveTripBtn');
        if (startActivityButton) startActivityButton.style.display = 'none';

    } catch (e) {
        console.error('Error saving active office data to localStorage:', e);
        alert('Could not save activity data locally. Please try again.');
        activeActivityData = null;
        localStorage.removeItem(ACTIVE_ACTIVITY_KEY);
        const startActivityButton = document.getElementById('saveTripBtn');
        if (startActivityButton) startActivityButton.style.display = 'block';
    }
}

// --- NEW: Complete Office Work ---
function handleCompleteOfficeWork() {
    if (!activeActivityData || activeActivityData.type !== 'office') {
        alert('No active office work found to complete.');
        return;
    }

    // Confirm completion? (Optional)
    // if (!confirm('Are you sure you want to complete this office work entry?')) {
    //     return;
    // }

    const completedOfficeEntry = {
        ...activeActivityData,
        endTime: new Date().toISOString(), // Set end time now
        status: 'completed'
    };

    console.log('Attempting to save completed office entry:', completedOfficeEntry);

    saveTrip(completedOfficeEntry, (success) => { // Use generic saveTrip
        if (success) {
            alert('Office work completed and saved successfully!');

            // Clear local state
            activeActivityData = null;
            localStorage.removeItem(ACTIVE_ACTIVITY_KEY);

            // Update UI
            if (activeOfficeInfoDiv) activeOfficeInfoDiv.style.display = 'none';
            const startActivityButton = document.getElementById('saveTripBtn');
            if (startActivityButton) startActivityButton.style.display = 'block'; // Show start button

        } else {
            alert('Failed to save completed office work.');
            // Keep active state? Or clear? Let's keep it for retry.
        }
    });
}

// --- NEW: Edit Office Work ---
function handleEditOfficeWork() {
     if (!activeActivityData || activeActivityData.type !== 'office') {
        alert('No active office work found to edit.');
        return;
    }
    console.log('Editing active office work:', activeActivityData);
    openOfficeEntryModal(true); // Open modal in editing mode
}

// --- Function to update vehicle KM (Needs Implementation) ---
function updateVehicleKm(vehicleName, newKm) {
    console.log(`Updating KM for ${vehicleName} to ${newKm}`);
    if (!db) {
        console.error('DB not available to update vehicle KM');
        return;
    }

    const transaction = db.transaction(['vehicles'], 'readwrite');
    const store = transaction.objectStore('vehicles');
    // We need the vehicle's ID to use put. Let's get it by name index.
    const index = store.index('name');
    const getRequest = index.get(vehicleName);

    getRequest.onsuccess = () => {
        const vehicle = getRequest.result;
        if (vehicle) {
            vehicle.currentKm = newKm;
            const putRequest = store.put(vehicle); // Use put to update
            putRequest.onsuccess = () => {
                console.log(`Successfully updated KM for ${vehicleName}`);
            };
            putRequest.onerror = (event) => {
                console.error(`Error updating KM for ${vehicleName}:`, event.target.error);
            };
        } else {
            console.warn(`Vehicle ${vehicleName} not found for KM update.`);
        }
    };
    getRequest.onerror = (event) => {
        console.error(`Error finding vehicle ${vehicleName} for KM update:`, event.target.error);
    };
}

// --- Display Active Trip Info (Travel) ---
function displayActiveTripInfo(trip) {
    // Use the globally defined constants instead of getting elements again
    if (activeTripInfoDiv && activeTripDetailsDiv && completeTripBtn && deleteTripBtn && editTripBtn) {
        activeTripDetailsDiv.innerHTML = `
            <div class="info-block"><strong>Start KM:</strong> ${trip.startKm}</div>
            <div class="info-block"><strong>Customer:</strong> ${trip.customer}</div>
            <div class="info-block"><strong>Purpose:</strong> ${trip.purpose}</div>
        `;
        // Make sure other active display is hidden
        if (activeOfficeInfoDiv) activeOfficeInfoDiv.style.display = 'none'; // Hide office info
        activeTripInfoDiv.style.display = 'block';

        // No need to set display style here as the buttons are in a container
        // that inherits visibility from activeTripInfoDiv
    } else {
        // Log which specific element might be missing for easier debugging
        console.error('Could not find active trip display elements or buttons. Check IDs:', {
            activeTripInfoDiv: !!activeTripInfoDiv,
            activeTripDetailsDiv: !!activeTripDetailsDiv,
            completeTripBtn: !!completeTripBtn,
            deleteTripBtn: !!deleteTripBtn,
            editTripBtn: !!editTripBtn // Check the global constant
        });
    }
}

// --- NEW: Display Active Office Info ---
function displayActiveOfficeInfo(officeData) {
    if (activeOfficeInfoDiv && activeOfficeDetailsDiv && editOfficeWorkBtn && completeOfficeWorkBtn) {
        // Create a container for the top row (Customer & Purpose)
        activeOfficeDetailsDiv.innerHTML = `
            <div class="office-info-row">
                <div class="info-block office-customer"><strong>Customer:</strong> ${officeData.customer}</div>
                <div class="info-block office-purpose"><strong>Purpose:</strong> ${officeData.purpose}</div>
            </div>
            <div class="work-details-section">
                <strong>Work Details:</strong>
                <textarea id="activeWorkDetailsTextarea" class="details-content-editable">${officeData.workDetails}</textarea>
            </div>
        `;

        // Add event listener to the new textarea
        const detailsTextarea = document.getElementById('activeWorkDetailsTextarea');
        if (detailsTextarea) {
            detailsTextarea.addEventListener('change', (event) => {
                if (activeActivityData && activeActivityData.type === 'office') {
                    console.log('Work details changed, updating...');
                    activeActivityData.workDetails = event.target.value;
                    try {
                        localStorage.setItem(ACTIVE_ACTIVITY_KEY, JSON.stringify(activeActivityData));
                        console.log('Active office data updated in localStorage after details edit.');
                    } catch (e) {
                        console.error('Error saving updated office data to localStorage:', e);
                        alert('Could not save updated work details.');
                    }
                }
            });

            // Auto-resize textarea height based on content
            function autoResizeTextarea() {
                detailsTextarea.style.height = 'auto';
                detailsTextarea.style.height = detailsTextarea.scrollHeight + 'px';
            }
            detailsTextarea.addEventListener('input', autoResizeTextarea);
            // Initial resize on display
            setTimeout(autoResizeTextarea, 0);
        }

        // Make sure other active display is hidden
        if (activeTripInfoDiv) activeTripInfoDiv.style.display = 'none';
        activeOfficeInfoDiv.style.display = 'block';
    } else {
        console.error('Could not find active office display elements.');
    }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    // Target the main "Start New Activity" button
    const startNewActivityBtn = document.getElementById('saveTripBtn');
    const viewTripsBtn = document.getElementById('viewTripsBtn');
    const manageCustomersBtn = document.getElementById('manageCustomersBtn');
    const manageVehiclesBtn = document.getElementById('manageVehiclesBtn');
    const manageDataBtn = document.getElementById('manageDataBtn');
    const workScheduleBtn = document.getElementById('workScheduleBtn'); // <-- Get the new button
    const completeTripBtnOnPage = document.getElementById('completeTripBtn'); // Travel complete
    const editTripBtnOnPage = document.getElementById('editTripBtn'); // Travel edit button
    const workReminderBtn = document.getElementById('workReminderBtn'); // Get the reminder button
    const closeReminderModalBtn = document.getElementById('closeReminderModalBtn'); // Get the reminder close button
    const workReminderForm = document.getElementById('workReminderForm'); // Get the reminder form

    console.log('Work Reminder Button Element:', workReminderBtn);

    // --- MODIFIED: Main Start Button checks for *any* active activity ---
    if (startNewActivityBtn) {
        startNewActivityBtn.addEventListener('click', (event) => {
            event.preventDefault();
            // Check if *any* activity is already active
            if (localStorage.getItem(ACTIVE_ACTIVITY_KEY)) {
                 alert('An activity (Travel or Office Work) is already in progress. Please complete it first.');
                 return;
            }
            // Check user selected
            const userSelect = document.getElementById('userSelect');
            if (!userSelect || !userSelect.value) {
                alert('Please select a user first.');
                return;
            }
            openStartChoiceModal(); // Open the choice modal
        });
    } else {
        console.warn('Button with ID "saveTripBtn" not found');
    }

    // Complete Trip Button (Travel) - No change in listener setup
    if (completeTripBtnOnPage) {
        completeTripBtnOnPage.addEventListener('click', openEndTripModal);
    }

    // Start Trip Modal (Travel) Listeners - No change
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeStartTripModal);
    if (startTripForm) startTripForm.addEventListener('submit', handleStartTripFormSubmit);

    // End Trip Modal (Travel) Listeners - No change
    if (closeEndModalBtn) closeEndModalBtn.addEventListener('click', closeEndTripModal);
    if (endTripForm) endTripForm.addEventListener('submit', handleEndTripFormSubmit);

    // Start Choice Modal Listeners - No change
    if (closeStartChoiceModalBtn) closeStartChoiceModalBtn.addEventListener('click', closeStartChoiceModal);
    if (startChoiceCancelBtn) startChoiceCancelBtn.addEventListener('click', closeStartChoiceModal);
    if (startTravelBtn) {
        startTravelBtn.addEventListener('click', () => {
            closeStartChoiceModal();
            openStartTripModal(); // Open travel modal
        });
    }
    if (startOfficeBtn) {
        startOfficeBtn.addEventListener('click', () => {
            closeStartChoiceModal();
            openOfficeEntryModal(false); // Open office modal for NEW entry
        });
    }

    // Office Entry Modal Listeners
    if (closeOfficeEntryModalBtn) closeOfficeEntryModalBtn.addEventListener('click', closeOfficeEntryModal);
    if (officeEntryForm) officeEntryForm.addEventListener('submit', handleSaveOfficeEntry); // Handles save/update

    // --- NEW: Active Office Work Button Listeners ---
    if (editOfficeWorkBtn) {
        editOfficeWorkBtn.addEventListener('click', handleEditOfficeWork);
    } else {
        console.warn('Button with ID "editOfficeWorkBtn" not found');
    }
    if (completeOfficeWorkBtn) {
        completeOfficeWorkBtn.addEventListener('click', handleCompleteOfficeWork);
                    } else {
        console.warn('Button with ID "completeOfficeWorkBtn" not found');
    }

    // Close modals if clicked outside
    window.addEventListener('click', (event) => {
        if (event.target === startTripModal) {
            closeStartTripModal();
        }
        if (event.target === endTripModal) {
            closeEndTripModal();
        }
        // --- NEW: Add checks for new modals ---
        if (event.target === startChoiceModal) {
            closeStartChoiceModal();
        }
        if (event.target === officeEntryModal) {
            closeOfficeEntryModal();
        }
        if (event.target === workReminderModal) { // <-- ADD THIS CHECK
            closeWorkReminderModal();
        }
    });

    // Navigation Button Listeners - No change
    if (viewTripsBtn) {
        viewTripsBtn.addEventListener('click', () => {
            window.location.href = 'tripsheet.html';
            });
    }
    // --- NEW: Work Schedule Button Listener ---
    if (workScheduleBtn) {
        workScheduleBtn.addEventListener('click', () => {
            window.location.href = 'Work_Schedule.html'; // Navigate to the new page
        });
    } else {
        console.warn('Button with ID "workScheduleBtn" not found');
    }
    // --- End New Listener ---
    if (manageCustomersBtn) {
        manageCustomersBtn.addEventListener('click', () => {
            window.location.href = 'customers.html';
        });
    }
    if (manageVehiclesBtn) {
        manageVehiclesBtn.addEventListener('click', () => {
            window.location.href = 'vehicles.html';
        });
    }
    if (manageDataBtn) {
        manageDataBtn.addEventListener('click', () => {
            window.location.href = 'datamanagement.html';
        });
    }

    // Add a new function to handle deleting an office task
    if (deleteOfficeWorkBtn) {
        deleteOfficeWorkBtn.addEventListener('click', handleDeleteOfficeWork);
    } else {
        console.warn('Button with ID "deleteOfficeWorkBtn" not found');
    }

    // NEW: Add listener for the delete trip button
    if (deleteTripBtn) {
        deleteTripBtn.addEventListener('click', handleDeleteTripTask);
    } else {
        console.warn('Button with ID "deleteTripBtn" not found');
    }

    // --- NEW: Edit Trip Button Listener ---
    if (editTripBtnOnPage) {
        editTripBtnOnPage.addEventListener('click', handleEditTripTask);
    } else {
        console.warn('Button with ID "editTripBtn" not found');
    }

    // --- NEW: Work Reminder Button Listener ---
    if (workReminderBtn) {
        console.log('Attaching click listener to Work Reminder Button');
        workReminderBtn.addEventListener('click', openWorkReminderModal);
    } else {
        console.warn('Button with ID "workReminderBtn" not found');
    }

    // --- NEW: Work Reminder Modal Close Button Listener ---
    if (closeReminderModalBtn) {
        console.log('Attaching click listener to Work Reminder Close Button'); // Add log
        closeReminderModalBtn.addEventListener('click', closeWorkReminderModal);
    } else {
        console.warn('Button with ID "closeReminderModalBtn" not found');
    }

    // --- NEW: Work Reminder Form Submit Listener (IMPLEMENTED) ---
    const reminderTypeSelect = document.getElementById('reminderType'); // Get the type dropdown

    if (workReminderForm) {
        console.log('Attaching submit listener to Work Reminder Form');
        workReminderForm.addEventListener('submit', (event) => {
            event.preventDefault(); // Prevent actual form submission
            console.log('Work Reminder form submitted');

            const type = reminderTypeSelect.value; // Get the selected type
            const customer = reminderCustomerSelect.value;
            const purpose = reminderPurposeInput.value.trim();
            const reminderDate = reminderDateInput.value; // Format YYYY-MM-DD

            if (!type || !customer || !purpose || !reminderDate) {
                alert('Please fill in all fields.');
                return;
            }

            const reminderData = {
                type: type, // Add the type to the reminder data
                customer: customer,
                purpose: purpose,
                reminderDate: reminderDate,
                createdAt: new Date().toISOString(), // Optional: track when it was created
                status: 'pending' // Optional: track status (pending, done, etc.)
            };

            console.log('Attempting to save reminder:', reminderData);

            saveReminder(reminderData, (success) => {
                if (success) {
                    alert('Work reminder saved successfully!');
                    closeWorkReminderModal(); // Close modal after successful save
                } else {
                    alert('Failed to save work reminder. Please try again.');
                }
            });
        });
    } else {
        console.warn('Form with ID "workReminderForm" not found');
    }
}

// --- Function to add default vehicle ---
function addDefaultVehicleIfNeeded() {
    if (!db) {
        console.error('DB not available to add default vehicle.');
        return;
    }

    const transaction = db.transaction(['vehicles'], 'readwrite');
    const store = transaction.objectStore('vehicles');
    const index = store.index('name'); // Use the name index
    const getRequest = index.get('Test'); // Check if 'Test' vehicle exists

    getRequest.onsuccess = () => {
        if (!getRequest.result) {
            // 'Test' vehicle doesn't exist, so add it
            console.log('Default vehicle "Test" not found. Adding it.');
            const defaultVehicle = {
                name: 'Test',
                currentKm: 500
                // licensePlate: '5555' // Add this later if schema is updated
            };
            const addRequest = store.add(defaultVehicle);

            addRequest.onsuccess = () => {
                console.log('Default vehicle "Test" added successfully.');
                // Re-populate dropdown if needed, though it happens later anyway
                // populateVehicleDropdown();
            };
            addRequest.onerror = (event) => {
                console.error('Error adding default vehicle "Test":', event.target.error);
            };
        } else {
            // 'Test' vehicle already exists
            console.log('Default vehicle "Test" already exists.');
        }
    };

    getRequest.onerror = (event) => {
        console.error('Error checking for default vehicle "Test":', event.target.error);
    };

    transaction.onerror = (event) => {
        console.error('Transaction error while checking/adding default vehicle:', event.target.error);
    };
}

// Add a new function to handle deleting an office task
function handleDeleteOfficeWork() {
    if (!activeActivityData || activeActivityData.type !== 'office') {
        alert('No active office work found to delete.');
        return;
    }

    // Confirm deletion
    if (confirm('Are you sure you want to delete this office task? This action cannot be undone.')) {
        console.log('Deleting office task:', activeActivityData);
        
        // Clear the active activity data
        activeActivityData = null;
        localStorage.removeItem(ACTIVE_ACTIVITY_KEY);
        
        // Update UI
        if (activeOfficeInfoDiv) {
            activeOfficeInfoDiv.style.display = 'none';
        }
        
        const startActivityButton = document.getElementById('saveTripBtn');
        if (startActivityButton) {
            startActivityButton.style.display = 'block';
        }
        
        alert('Office task deleted');
    }
}

// Add a new function to handle deleting a trip task
function handleDeleteTripTask() {
    if (!activeActivityData || activeActivityData.type !== 'travel') {
        alert('No active trip found to delete.');
        return;
    }

    // Confirm deletion
    if (confirm('Are you sure you want to delete this trip? This action cannot be undone.')) {
        console.log('Deleting active trip:', activeActivityData);
        
        // Clear the active activity data
        activeActivityData = null;
        localStorage.removeItem(ACTIVE_ACTIVITY_KEY);
        
        // Update UI
        if (activeTripInfoDiv) {
            activeTripInfoDiv.style.display = 'none';
        }
        
        const startActivityButton = document.getElementById('saveTripBtn');
        if (startActivityButton) {
            startActivityButton.style.display = 'block';
        }
        
        alert('Trip deleted');
    }
}

// --- NEW: Edit Trip Task ---
function handleEditTripTask() {
    if (!activeActivityData || activeActivityData.type !== 'travel') {
        alert('No active trip found to edit.');
        return;
    }
    console.log('Editing active trip:', activeActivityData);
    openStartTripModal(true); // Open modal in editing mode
}

// --- NEW: Work Reminder Modal Functions (Moved Earlier) ---
function openWorkReminderModal() {
    console.log('openWorkReminderModal function called');
    if (workReminderModal) {
        // Clear previous values
        reminderPurposeInput.value = '';
        reminderDateInput.value = ''; // Clear date

        // Populate customers and then display
        populateCustomerDropdown('reminderCustomerSelect', () => {
            reminderCustomerSelect.value = ''; // Ensure default is selected
            console.log('Setting workReminderModal display to block');
            workReminderModal.style.display = 'block';
            console.log('Work Reminder modal opened.');
        });
    } else {
        console.error('Work Reminder modal element not found.');
    }
}

function closeWorkReminderModal() {
    if (workReminderModal) {
        console.log('Closing Work Reminder modal'); // Add log
        workReminderModal.style.display = 'none';
    }
}

// --- Function to save a reminder ---
function saveReminder(reminderData, callback) {
    if (!db) {
        console.error('DB not available to save reminder');
        if (callback) callback(false);
        return;
    }
    const transaction = db.transaction(['reminders'], 'readwrite');
    const store = transaction.objectStore('reminders');
    const request = store.add(reminderData);

    request.onsuccess = () => {
        console.log('Reminder saved successfully to DB:', reminderData);
        if (callback) callback(true, request.result);
    };

    request.onerror = (event) => {
        console.error('Error saving reminder to DB:', event.target.error);
        if (callback) callback(false);
    };
}

function getRemindersFromDB(callback) {
    if (!db) {
        console.error('DB not available to fetch reminders');
        callback([]);
        return;
    }
    const transaction = db.transaction(['reminders'], 'readonly');
    const store = transaction.objectStore('reminders');
    const request = store.getAll();

    request.onsuccess = () => {
        const reminders = request.result || [];
        console.log('Fetched reminders from DB:', reminders);
        reminders.sort((a, b) => (a.reminderDate || '').localeCompare(b.reminderDate || ''));
        callback(reminders);
    };

    request.onerror = (event) => {
        console.error('Error fetching reminders from DB:', event.target.error);
        callback([]);
    };
}

function setReminderAsActive(reminderId) {
    if (!db) {
        console.error('DB not available to fetch reminder');
        return;
    }

    const transaction = db.transaction(['reminders'], 'readonly');
    const store = transaction.objectStore('reminders');
    const request = store.get(Number(reminderId));

    request.onsuccess = () => {
        const reminder = request.result;
        if (!reminder) {
            alert('Reminder not found.');
            return;
        }

        // Set the reminder as the active task
        const activeTask = {
            type: reminder.type,
            customer: reminder.customer,
            purpose: reminder.purpose,
            startTime: new Date().toISOString(),
            status: 'active',
            reminderId: reminder.id // Optional: Track the reminder ID
        };

        activeActivityData = activeTask;
        try {
            localStorage.setItem(ACTIVE_ACTIVITY_KEY, JSON.stringify(activeActivityData));
            console.log('Reminder set as active:', activeTask);

            // Update the UI to show the active task
            if (activeTask.type === 'travel') {
                displayActiveTripInfo(activeTask);
            } else if (activeTask.type === 'office') {
                displayActiveOfficeInfo(activeTask);
            }

            // Hide the "Start New Activity" button
            const startActivityButton = document.getElementById('saveTripBtn');
            if (startActivityButton) {
                startActivityButton.style.display = 'none';
            }

            alert('Task set as active. You can now start working on it.');
        } catch (e) {
            console.error('Error setting reminder as active:', e);
            alert('Failed to set task as active. Please try again.');
        }
    };

    request.onerror = (event) => {
        console.error('Error fetching reminder:', event.target.error);
        alert('Failed to fetch reminder. Please try again.');
    };
}
