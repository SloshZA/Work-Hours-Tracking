let db;

const request = indexedDB.open('TripTrackerDB', 4);

request.onupgradeneeded = (event) => {
    console.log('App.js: DB upgrade needed.');
    db = event.target.result;
    if (!db.objectStoreNames.contains('trips')) {
        db.createObjectStore('trips', { keyPath: 'id', autoIncrement: true });
    }
    if (!db.objectStoreNames.contains('customers')) {
        db.createObjectStore('customers', { keyPath: 'id', autoIncrement: true });
    }
    if (!db.objectStoreNames.contains('vehicles')) {
        db.createObjectStore('vehicles', { keyPath: 'id', autoIncrement: true });
    }
    if (!db.objectStoreNames.contains('preferences')) {
        db.createObjectStore('preferences', { keyPath: 'id' });
    }
};

request.onsuccess = (event) => {
    db = event.target.result;
    console.log('App.js: Database opened successfully for Main Page.');
    initializeUI();
};

request.onerror = (event) => {
    console.error('App.js: Error opening database:', event.target.error);
    alert('Database could not be opened. Please check console for errors.');
};

function saveTrip(trip, callback) {
    if (!db) {
        console.error('App.js: Database not initialized.');
        alert('Database error. Cannot save trip.');
        if (callback) callback(false);
        return;
    }
    
    // Save user and vehicle preferences
    savePreference('lastUser', trip.user);
    savePreference('lastVehicle', trip.vehicle);
    
    // Update vehicle's current KM
    updateVehicleCurrentKm(trip.vehicle, trip.endKm);
    
    let transaction;
    try {
        transaction = db.transaction(['trips'], 'readwrite');
        console.log('App.js: Save transaction started.');
        const store = transaction.objectStore('trips');
        const request = store.add(trip);

        request.onsuccess = () => {
            console.log('App.js: Trip add request successful.');
        };
        request.onerror = (event) => {
            console.error('App.js: Error saving trip in request:', event.target.error);
        };

        transaction.oncomplete = () => {
            console.log('App.js: Save transaction completed successfully.');
            if (callback) callback(true);
        };
        transaction.onerror = (event) => {
            console.error('App.js: Save transaction error:', event.target.error);
            if (callback) callback(false);
        };

    } catch (error) {
        console.error('App.js: Error creating save transaction:', error);
        alert('Database transaction error during save.');
        if (callback) callback(false);
    }
}

function getTrips(callback) {
    if (!db) {
        console.error('Database not initialized.');
        alert('Database error. Cannot get trips.');
        return;
    }
    const transaction = db.transaction(['trips'], 'readonly');
    const store = transaction.objectStore('trips');
    const request = store.getAll();

    request.onsuccess = () => {
        callback(request.result);
    };
    request.onerror = (event) => {
        console.error('Error getting trips:', event.target.error);
        callback([]); // Return empty array on error
    };
}

function saveCustomer(customer, callback) {
    if (!db) {
        console.error('Database not initialized.');
        alert('Database error. Cannot save customer.');
        return;
    }
    const transaction = db.transaction(['customers'], 'readwrite');
    const store = transaction.objectStore('customers');
    const request = store.add(customer);

    request.onsuccess = () => {
        console.log('Customer saved successfully');
        if (callback) callback(true);
    };
    request.onerror = (event) => {
        console.error('Error saving customer:', event.target.error);
        if (callback) callback(false);
    };
}

function getCustomers(callback) {
    if (!db) {
        console.error('Database not initialized.');
        alert('Database error. Cannot get customers.');
        return;
    }
    const transaction = db.transaction(['customers'], 'readonly');
    const store = transaction.objectStore('customers');
    const request = store.getAll();

    request.onsuccess = () => {
        callback(request.result);
    };
    request.onerror = (event) => {
        console.error('Error getting customers:', event.target.error);
        callback([]); // Return empty array on error
    };
}

function getVehicles(callback) {
    if (!db) {
        console.error('Database not initialized.');
        alert('Database error. Cannot get vehicles.');
        return;
    }
    const transaction = db.transaction(['vehicles'], 'readonly');
    const store = transaction.objectStore('vehicles');
    const request = store.getAll();

    request.onsuccess = () => {
        callback(request.result);
    };
    request.onerror = (event) => {
        console.error('Error getting vehicles:', event.target.error);
        callback([]); // Return empty array on error
    };
}

function savePreference(key, value) {
    if (!db) {
        console.error('Database not initialized.');
        return;
    }
    const transaction = db.transaction(['preferences'], 'readwrite');
    const store = transaction.objectStore('preferences');
    
    const preference = {
        id: key,
        value: value
    };
    
    store.put(preference);
}

function getPreference(key, callback) {
    if (!db) {
        console.error('Database not initialized.');
        if (callback) callback(null);
        return;
    }
    
    const transaction = db.transaction(['preferences'], 'readonly');
    const store = transaction.objectStore('preferences');
    const request = store.get(key);
    
    request.onsuccess = () => {
        const result = request.result ? request.result.value : null;
        if (callback) callback(result);
    };
    
    request.onerror = () => {
        if (callback) callback(null);
    };
}

// --- New Function: Populate Customer Dropdown ---
function populateCustomerDropdown(customers) {
    const selectElement = document.getElementById('customerSelect');
    // Clear existing options except the default
    selectElement.innerHTML = '<option value="">-- Select Customer --</option>';

    if (customers && customers.length > 0) {
        customers.sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
        customers.forEach(customer => {
            const option = document.createElement('option');
            option.value = customer.name; // Use name as value for simplicity
            option.textContent = customer.name;
            // You might store customer.id in option.value if needed later
            selectElement.appendChild(option);
        });
    }
    console.log('App.js: Customer dropdown populated.');
}

// --- New Function: Populate Vehicle Dropdown ---
function populateVehicleDropdown(vehicles) {
    const selectElement = document.getElementById('vehicleSelect');
    // Clear existing options except the default
    selectElement.innerHTML = '<option value="">-- Select Vehicle --</option>';

    if (vehicles && vehicles.length > 0) {
        vehicles.sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
        vehicles.forEach(vehicle => {
            const option = document.createElement('option');
            option.value = vehicle.name; // Use name as value for simplicity
            option.textContent = vehicle.name;
            // Store the current KM as a data attribute
            option.dataset.currentKm = vehicle.currentKm || '';
            selectElement.appendChild(option);
        });
    }
    console.log('App.js: Vehicle dropdown populated.');
    
    // Select last used vehicle
    getPreference('lastVehicle', (lastVehicle) => {
        if (lastVehicle && selectElement.querySelector(`option[value="${lastVehicle}"]`)) {
            selectElement.value = lastVehicle;
            // We'll let the user manually click the dropdown instead of auto-populating
            // This ensures the startKm field stays empty on page refresh
        }
    });
}

// Function to initialize UI elements and add event listeners
function initializeUI() {
    const startKmInput = document.getElementById('startKmInput');
    const endKmInput = document.getElementById('endKmInput');
    const userSelect = document.getElementById('userSelect');
    const vehicleSelect = document.getElementById('vehicleSelect');
    const customerSelect = document.getElementById('customerSelect');
    const purposeInput = document.getElementById('purposeInput');
    const saveTripBtn = document.getElementById('saveTripBtn');
    const viewTripsBtn = document.getElementById('viewTripsBtn');
    const manageCustomersBtn = document.getElementById('manageCustomersBtn');
    const manageVehiclesBtn = document.getElementById('manageVehiclesBtn');
    const importTripBtn = document.getElementById('importTripBtn');

    // Clear input fields on page load
    startKmInput.value = '';
    endKmInput.value = '';
    purposeInput.value = '';

    // --- Populate dropdowns on load ---
    getCustomers(populateCustomerDropdown);
    getVehicles(populateVehicleDropdown);
    
    // Select last used user
    getPreference('lastUser', (lastUser) => {
        if (lastUser && userSelect.querySelector(`option[value="${lastUser}"]`)) {
            userSelect.value = lastUser;
        }
    });
    
    // Add event listener for vehicle selection to populate start KM
    vehicleSelect.addEventListener('change', () => {
        const selectedOption = vehicleSelect.options[vehicleSelect.selectedIndex];
        if (selectedOption && selectedOption.dataset.currentKm) {
            startKmInput.value = selectedOption.dataset.currentKm;
        }
    });

    saveTripBtn.addEventListener('click', () => {
        const startKm = startKmInput.value;
        const endKm = endKmInput.value;
        const user = userSelect.value;
        const vehicle = vehicleSelect.value;
        const customer = customerSelect.value;
        const purpose = purposeInput.value.trim();

        if (!customer) {
            alert('Please select a customer.');
            return;
        }
        
        if (!user) {
            alert('Please select a user.');
            return;
        }
        
        if (!vehicle) {
            alert('Please select a vehicle.');
            return;
        }

        if (startKm && endKm && customer && purpose) {
            if (isNaN(parseInt(startKm)) || isNaN(parseInt(endKm))) {
                alert('Start KM and End KM must be numbers.');
                return;
            }
            if (parseInt(endKm) < parseInt(startKm)) {
                alert('End KM cannot be less than Start KM.');
                return;
            }

            const trip = {
                startKm: parseInt(startKm),
                endKm: parseInt(endKm),
                user,
                vehicle,
                customer,
                purpose,
                date: new Date().toISOString()
            };
            saveTrip(trip, (success) => {
                if (success) {
                    alert('Trip saved successfully!');
                    startKmInput.value = '';
                    endKmInput.value = '';
                    purposeInput.value = '';

                    // Refresh the vehicle dropdown to get updated KM values
                    getVehicles(populateVehicleDropdown);

                    console.log('App.js: Attempting to read trips immediately after save...');
                    getTrips((trips) => {
                        console.log('App.js: Trips found immediately after save:', trips);
                    });

                } else {
                    alert('Failed to save trip.');
                }
            });
        } else {
            if (!startKm || !endKm || !purpose) {
                alert('All fields are required.');
            }
        }
    });

    viewTripsBtn.addEventListener('click', () => {
        window.location.href = 'tripsheet.html';
    });

    manageCustomersBtn.addEventListener('click', () => {
        // Navigate to the new customers page
        window.location.href = 'customers.html';
    });
    
    manageVehiclesBtn.addEventListener('click', () => {
        // Navigate to the vehicles page
        window.location.href = 'vehicles.html';
    });

    importTripBtn.addEventListener('click', () => {
        const apiKey = 'YOUR_GOOGLE_MAPS_API_KEY'; // Replace with your API key
        const startDate = prompt('Enter Start Date (YYYY-MM-DD):');
        const endDate = prompt('Enter End Date (YYYY-MM-DD):');

        if (startDate && endDate) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
                alert('Invalid date format. Please use YYYY-MM-DD.');
                return;
            }

            console.log(`Fetching timeline data for ${startDate} to ${endDate}`);
            alert('Google Maps import functionality is not fully implemented yet.');
        } else {
            alert('Start and end dates are required.');
        }
    });
}

// Function to update vehicle's current KM
function updateVehicleCurrentKm(vehicleName, endKm) {
    if (!db || !vehicleName || !endKm) return;
    
    // First get all vehicles to find the matching one
    const transaction = db.transaction(['vehicles'], 'readonly');
    const store = transaction.objectStore('vehicles');
    const request = store.getAll();
    
    request.onsuccess = () => {
        const vehicles = request.result;
        if (!vehicles || !vehicles.length) return;
        
        // Find the vehicle with matching name
        const vehicle = vehicles.find(v => v.name === vehicleName);
        if (!vehicle) return;
        
        // Update the vehicle's current KM
        vehicle.currentKm = parseInt(endKm);
        
        // Save the updated vehicle
        const updateTransaction = db.transaction(['vehicles'], 'readwrite');
        const updateStore = updateTransaction.objectStore('vehicles');
        updateStore.put(vehicle);
        
        console.log(`Updated vehicle ${vehicleName} current KM to ${endKm}`);
    };
}
