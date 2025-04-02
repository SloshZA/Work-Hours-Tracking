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

// --- References for Active Displays ---
const activeTripInfoDiv = document.getElementById('activeTripInfo');
const activeTripDetailsDiv = document.getElementById('activeTripDetails');
const activeOfficeInfoDiv = document.getElementById('activeOfficeInfo');
const activeOfficeDetailsDiv = document.getElementById('activeOfficeDetails');
const editOfficeWorkBtn = document.getElementById('editOfficeWorkBtn');
const completeOfficeWorkBtn = document.getElementById('completeOfficeWorkBtn');

const request = indexedDB.open('TripTrackerDB', 3);

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

// Start Trip Modal (Travel) - No changes needed to open/close/submit logic itself
function openStartTripModal() {
    const vehicleSelect = document.getElementById('vehicleSelect');
    const selectedOption = vehicleSelect.options[vehicleSelect.selectedIndex];

    if (!selectedOption || !selectedOption.value) {
        alert('Please select a vehicle first.');
        return;
    }

    const vehicleName = selectedOption.value;
    const currentKm = selectedOption.dataset.currentKm || '0';

    // Populate modal fields
    modalVehicleDisplay.textContent = vehicleName;
    modalStartKmInput.value = currentKm;
    modalPurposeInput.value = ''; // Clear previous purpose
    populateCustomerDropdown('modalCustomer', () => {
        // This callback is empty as the populateCustomerDropdown function now handles the callback
    }); // Populate customers

    startTripModal.style.display = 'block';
}

function closeStartTripModal() {
    if (startTripModal) {
        startTripModal.style.display = 'none';
    }
}

function handleStartTripFormSubmit(event) {
    event.preventDefault();

    const vehicleName = modalVehicleDisplay.textContent;
    const startKm = modalStartKmInput.value;
    const customer = modalCustomerSelect.value;
    const purpose = modalPurposeInput.value;
    const userSelect = document.getElementById('userSelect'); // Get user dropdown
    const user = userSelect ? userSelect.value : 'Unknown'; // Get selected user

    // Add validation for user selection if needed
    if (!user) {
        alert('Please select a user.');
        // Optionally re-enable userSelect if it was disabled
        return;
    }

    if (!vehicleName || !startKm || !customer || !purpose) {
        alert('Please fill in all fields.');
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
        type: 'travel' // Explicitly set type
    };

    console.log('Travel activity started:', trip);

    // Store in global variable and localStorage using the unified key
    activeActivityData = trip;
    try {
        localStorage.setItem(ACTIVE_ACTIVITY_KEY, JSON.stringify(activeActivityData));
        console.log('Active travel data saved to localStorage.');
        savePreference('lastUser', user);
    } catch (e) {
        console.error('Error saving active travel data to localStorage:', e);
        alert('Could not save activity data locally. Please try again.');
        activeActivityData = null;
        return;
    }

    displayActiveTripInfo(trip);
    closeStartTripModal();

    const startActivityButton = document.getElementById('saveTripBtn');
    if (startActivityButton) {
        startActivityButton.style.display = 'none';
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
    if (!workDetails) {
        alert('Please enter work details.');
        return;
    }

    const now = new Date().toISOString();
    let officeEntryData;

    if (activeActivityData && activeActivityData.type === 'office') {
        // --- Editing existing active office work ---
        console.log('Updating active office entry...');
        officeEntryData = {
            ...activeActivityData, // Keep original startTime, user, type etc.
            customer: customer,
            purpose: purpose,
            workDetails: workDetails,
            // Update user only if it changed? Or always? Let's update always for simplicity.
            user: user,
            // Don't change status or endTime here
        };
    } else {
        // --- Creating new active office work ---
        console.log('Starting new office entry...');
        officeEntryData = {
            user: user,
            customer: customer,
            purpose: purpose, // Add purpose
            workDetails: workDetails,
            startTime: now,
            // endTime: now, // Remove: Set only on completion
            date: now,
            status: 'active', // Start as active
            type: 'office',
            // Fields not relevant to office work
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

        // Hide start button if it's not already hidden
        const startActivityButton = document.getElementById('saveTripBtn');
        if (startActivityButton) startActivityButton.style.display = 'none';

    } catch (e) {
        console.error('Error saving active office data to localStorage:', e);
        alert('Could not save activity data locally. Please try again.');
        // Don't clear activeActivityData here if saving failed, allow retry?
        // Or maybe clear it to prevent inconsistent state? Let's clear it.
        activeActivityData = null;
        localStorage.removeItem(ACTIVE_ACTIVITY_KEY);
        // Potentially show the start button again if we cleared the state
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
    const completeBtn = document.getElementById('completeTripBtn'); // Get the button

    if (activeTripInfoDiv && activeTripDetailsDiv && completeBtn) {
        activeTripDetailsDiv.innerHTML = `
            <div class="info-block"><strong>Start KM:</strong> ${trip.startKm}</div>
            <div class="info-block"><strong>Customer:</strong> ${trip.customer}</div>
            <div class="info-block"><strong>Purpose:</strong> ${trip.purpose}</div>
        `;
        // Make sure other active display is hidden
        if (activeOfficeInfoDiv) activeOfficeInfoDiv.style.display = 'none'; // Hide office info
        activeTripInfoDiv.style.display = 'block';
        completeBtn.style.display = 'block'; // Make sure complete button is visible
    } else {
        console.error('Could not find active trip display elements or complete button.');
    }
}

// --- NEW: Display Active Office Info ---
function displayActiveOfficeInfo(officeData) {
    if (activeOfficeInfoDiv && activeOfficeDetailsDiv && editOfficeWorkBtn && completeOfficeWorkBtn) {
        activeOfficeDetailsDiv.innerHTML = `
            <div class="info-block"><strong>Customer:</strong> ${officeData.customer}</div>
            <div class="info-block"><strong>Purpose:</strong> ${officeData.purpose}</div>
            <div class="info-block"><strong>Details:</strong> ${officeData.workDetails.replace(/\n/g, '<br>')}</div> <!-- Display newlines -->
        `;
        // Make sure other active display is hidden
        if (activeTripInfoDiv) activeTripInfoDiv.style.display = 'none'; // Now this should work
        activeOfficeInfoDiv.style.display = 'block'; // Show office info
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
    const completeTripBtnOnPage = document.getElementById('completeTripBtn'); // Travel complete

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
    });

    // Navigation Button Listeners - No change
    if (viewTripsBtn) {
        viewTripsBtn.addEventListener('click', () => {
            window.location.href = 'tripsheet.html';
            });
    }
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
