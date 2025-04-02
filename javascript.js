let db;
let activeTripData = null; // Variable to hold the currently active trip

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
    
    // Check for an active trip in localStorage on load
    const storedTrip = localStorage.getItem('activeTripData');
    if (storedTrip) {
        try {
            activeTripData = JSON.parse(storedTrip);
            console.log('Restored active trip from localStorage:', activeTripData);
            displayActiveTripInfo(activeTripData); // Display it
            // Hide the start button if a trip is active
            const startTripButton = document.getElementById('saveTripBtn');
            if (startTripButton) {
                startTripButton.style.display = 'none';
            }
        } catch (e) {
            console.error('Error parsing stored active trip data:', e);
            localStorage.removeItem('activeTripData'); // Use localStorage
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

function populateCustomerDropdown(selectElementId) {
    const customerSelect = document.getElementById(selectElementId);
    if (!customerSelect) {
        console.error(`Customer select element with ID ${selectElementId} not found.`);
        return;
    }

    getCustomers((customers) => {
        console.log('Populating customers:', customers);
        // Keep the default option
        customerSelect.innerHTML = '<option value="">-- Select Customer --</option>';

        if (customers && customers.length > 0) {
            customers.forEach(customer => {
                const option = document.createElement('option');
                option.value = customer.name; // Assuming name is the identifier you want to save
                option.textContent = customer.name;
                customerSelect.appendChild(option);
            });
        } else {
            console.log('No customers found in database.');
            // Optionally add a default "No customers available" option or disable
        }
    });
}

// --- Modal Handling ---
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
    populateCustomerDropdown('modalCustomer'); // Populate customers

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
        user: user // Add the user field
        // date field will be added when completing
    };

    console.log('Trip started (not saved to DB yet):', trip);

    // Store in global variable and localStorage
    activeTripData = trip;
    try {
        localStorage.setItem('activeTripData', JSON.stringify(activeTripData));
        console.log('Active trip data saved to localStorage.');
        savePreference('lastUser', user); // Save the selected user
    } catch (e) {
        console.error('Error saving active trip data to localStorage:', e);
        alert('Could not save trip data locally. Please try again.');
        activeTripData = null;
        return;
    }

    displayActiveTripInfo(trip);
    closeStartTripModal();

    const startTripButton = document.getElementById('saveTripBtn');
    if (startTripButton) {
        startTripButton.style.display = 'none';
    }
    // Optionally disable user/vehicle selects while trip is active
    // if (userSelect) userSelect.disabled = true;
    // const vehicleSelectDropdown = document.getElementById('vehicleSelect');
    // if (vehicleSelectDropdown) vehicleSelectDropdown.disabled = true;
}

// --- End Trip Modal Functions ---
function openEndTripModal() {
    if (!activeTripData) {
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
    if (!activeTripData) {
        alert('Error: No active trip data found.');
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
    if (isNaN(endKmValue) || endKmValue < activeTripData.startKm) {
        alert('End KM must be a number and greater than or equal to Start KM.');
        return;
    }

    // Update the active trip data object
    const completedTrip = {
        ...activeTripData, // Copy existing data (includes user, startTime, etc.)
        endKm: endKmValue,
        workDetails: workDetails || '',
        endTime: new Date().toISOString(),
        status: 'completed',
        date: activeTripData.startTime // Add the date field using startTime
    };

    // Remove startTime if you only want 'date' in the final record
    // delete completedTrip.startTime;

    console.log('Attempting to save completed trip:', completedTrip);

    // Save the completed trip to IndexedDB
    saveTrip(completedTrip, () => {
        alert('Trip completed and saved successfully!');

        // Clear local state
        activeTripData = null;
        localStorage.removeItem('activeTripData');

        // Update UI
        const activeTripInfoDiv = document.getElementById('activeTripInfo');
        if (activeTripInfoDiv) {
            activeTripInfoDiv.style.display = 'none';
        }
        const startTripButton = document.getElementById('saveTripBtn');
        if (startTripButton) {
            startTripButton.style.display = 'block';
        }
        // Re-enable user/vehicle selects
        // const userSelect = document.getElementById('userSelect');
        // if (userSelect) userSelect.disabled = false;
        // const vehicleSelectDropdown = document.getElementById('vehicleSelect');
        // if (vehicleSelectDropdown) vehicleSelectDropdown.disabled = false;


        closeEndTripModal();

        updateVehicleKm(completedTrip.vehicle, completedTrip.endKm);
        populateVehicleDropdown();
    });
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

// --- Display Active Trip Info (Shows Complete Button) ---
function displayActiveTripInfo(trip) {
    const activeTripInfoDiv = document.getElementById('activeTripInfo');
    const activeTripDetailsDiv = document.getElementById('activeTripDetails');
    const completeBtn = document.getElementById('completeTripBtn'); // Get the button

    if (activeTripInfoDiv && activeTripDetailsDiv && completeBtn) {
        activeTripDetailsDiv.innerHTML = `
            <div class="info-block"><strong>Start KM:</strong> ${trip.startKm}</div>
            <div class="info-block"><strong>Customer:</strong> ${trip.customer}</div>
            <div class="info-block"><strong>Purpose:</strong> ${trip.purpose}</div>
        `;
        activeTripInfoDiv.style.display = 'block';
        completeBtn.style.display = 'block'; // Make sure complete button is visible
    } else {
        console.error('Could not find active trip display elements or complete button.');
    }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    // Target the button inside the form div now
    const startTripBtn = document.getElementById('saveTripBtn');
    const viewTripsBtn = document.getElementById('viewTripsBtn');
    const manageCustomersBtn = document.getElementById('manageCustomersBtn');
    const manageVehiclesBtn = document.getElementById('manageVehiclesBtn');
    const completeTripBtnOnPage = document.getElementById('completeTripBtn'); // Renamed variable

    if (startTripBtn) {
        startTripBtn.addEventListener('click', (event) => {
            event.preventDefault(); // Prevent potential form submission if button is type="submit"
            openStartTripModal();
        });
    } else {
        // Updated warning message
        console.warn('Button with ID "saveTripBtn" not found');
    }

    // Complete Trip Button (on main page, inside activeTripInfo)
    if (completeTripBtnOnPage) {
        completeTripBtnOnPage.addEventListener('click', openEndTripModal);
    } else {
        console.warn('Button with ID "completeTripBtn" not found');
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeStartTripModal);
    } else {
        console.warn('closeModalBtn not found');
    }

    if (startTripForm) {
        startTripForm.addEventListener('submit', handleStartTripFormSubmit);
    } else {
        console.warn('startTripForm not found');
    }

    // End Trip Modal Listeners
    if (closeEndModalBtn) {
        closeEndModalBtn.addEventListener('click', closeEndTripModal);
                    } else {
        console.warn('closeEndModalBtn not found');
                    }
    if (endTripForm) {
        endTripForm.addEventListener('submit', handleEndTripFormSubmit);
                } else {
        console.warn('endTripForm not found');
    }

    // Close modals if clicked outside the content area
    window.addEventListener('click', (event) => {
        if (event.target === startTripModal) {
            closeStartTripModal();
        }
        if (event.target === endTripModal) {
            closeEndTripModal();
        }
    });

    // --- View Trips Button Listener ---
    if (viewTripsBtn) {
        viewTripsBtn.addEventListener('click', () => {
            window.location.href = 'tripsheet.html';
            });
    } else {
        console.warn('viewTripsBtn not found');
    }

    // --- Manage Customers Button Listener ---
    if (manageCustomersBtn) {
        manageCustomersBtn.addEventListener('click', () => {
            // Navigate to customers.html
            window.location.href = 'customers.html';
        });
    } else {
        console.warn('manageCustomersBtn not found');
    }

    // --- Manage Vehicles Button Listener ---
    if (manageVehiclesBtn) {
        manageVehiclesBtn.addEventListener('click', () => {
            // Navigate to vehicles.html
            window.location.href = 'vehicles.html';
        });
    } else {
        console.warn('manageVehiclesBtn not found');
    }

    // Add listener for import button if it exists and is needed
    // const importTripBtn = document.getElementById('importTripBtn');
    // if (importTripBtn) { ... }
}
