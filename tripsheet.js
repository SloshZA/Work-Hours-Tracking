let db;
let allTrips = []; // Variable to store fetched trips
let sortSelectElement; // Reference to the dropdown
let kmDetailsModal, closeKmModalBtn, modalStartKmValue, modalEndKmValue; // Add variables for the new modal elements

// --- IndexedDB Setup (Similar to app.js) ---
const request = indexedDB.open('TripTrackerDB', 3);

request.onupgradeneeded = (event) => {
    console.log('TripSheet: DB upgrade needed.'); // Log upgrade
    const dbInstance = event.target.result;
    if (!dbInstance.objectStoreNames.contains('trips')) {
        dbInstance.createObjectStore('trips', { keyPath: 'id', autoIncrement: true });
    }
    if (!dbInstance.objectStoreNames.contains('customers')) {
        const customerStore = dbInstance.createObjectStore('customers', { keyPath: 'id', autoIncrement: true });
        if (!customerStore.indexNames.contains('name')) { // Check if index exists before creating
             customerStore.createIndex('name', 'name', { unique: false });
        }
    }
    if (!dbInstance.objectStoreNames.contains('vehicles')) {
        const vehicleStore = dbInstance.createObjectStore('vehicles', { keyPath: 'id', autoIncrement: true });
         if (!vehicleStore.indexNames.contains('name')) { // Check if index exists before creating
             vehicleStore.createIndex('name', 'name', { unique: true });
         }
    } else {
         // Also check index existence if store exists during upgrade
         const transaction = event.target.transaction;
         const vehicleStore = transaction.objectStore('vehicles');
         if (!vehicleStore.indexNames.contains('name')) {
             vehicleStore.createIndex('name', 'name', { unique: true });
         }
    }
    if (!dbInstance.objectStoreNames.contains('preferences')) {
        dbInstance.createObjectStore('preferences', { keyPath: 'id' });
    }
};

request.onsuccess = (event) => {
    db = event.target.result;
    console.log('TripSheet: Database opened successfully.'); // Log success

    // Get reference to sort dropdown
    sortSelectElement = document.getElementById('sortSelect');
    if (sortSelectElement) {
        sortSelectElement.addEventListener('change', handleSortChange);
    } else {
        console.error('TripSheet: Sort select element not found.');
    }

    // *** ADD A SMALL DELAY ***
    // Wait a fraction of a second before trying to load data
    setTimeout(() => {
        console.log('TripSheet: Delay finished, calling loadAndDisplayTrips.');
        loadAndDisplayTrips();
    }, 100); // 100 milliseconds delay (adjust if needed)

    // Get KM Details Modal elements
    kmDetailsModal = document.getElementById('kmDetailsModal');
    closeKmModalBtn = document.getElementById('closeKmModalBtn');
    modalStartKmValue = document.getElementById('modalStartKmValue');
    modalEndKmValue = document.getElementById('modalEndKmValue');
};

request.onerror = (event) => {
    console.error('TripSheet: Error opening database:', event.target.error); // Log error
    displayErrorMessage('Could not load trip data. Database error.');
};

// --- Data Fetching ---
function getTrips(callback) {
    console.log('TripSheet: getTrips called.'); // Log function call
    if (!db) {
        console.error('TripSheet: Database not initialized in getTrips.'); // Log DB state
        displayErrorMessage('Database error. Cannot get trips.');
        callback([]);
        return;
    }
    try {
        const transaction = db.transaction(['trips'], 'readonly');
        console.log('TripSheet: Read transaction started.'); // Log transaction start
        const store = transaction.objectStore('trips');
        const request = store.getAll();

        request.onsuccess = () => {
            console.log('TripSheet: getAll request successful. Found trips:', request.result); // Log retrieved data
            callback(request.result);
        };
        request.onerror = (event) => {
            console.error('TripSheet: Error getting trips in getAll request:', event.target.error); // Log request error
            displayErrorMessage('Failed to retrieve trips from the database.');
            callback([]);
        };
        transaction.onerror = (event) => {
             console.error('TripSheet: Read transaction error:', event.target.error); // Log transaction error
        };
        transaction.oncomplete = () => {
             console.log('TripSheet: Read transaction complete.'); // Log transaction complete
        };

    } catch (error) {
        console.error('TripSheet: Error creating transaction:', error); // Log transaction creation error
        displayErrorMessage('Database transaction error.');
        callback([]);
    }
}

// Function to get customers for dropdown
function getCustomers(callback) {
    if (!db) {
        console.error('Database not available');
        callback([]);
        return;
    }
    
    const transaction = db.transaction(['customers'], 'readonly');
    const store = transaction.objectStore('customers');
    const request = store.getAll();

    request.onsuccess = () => {
        console.log('Retrieved customers:', request.result);
        callback(request.result);
    };
    
    request.onerror = (event) => {
        console.error('Error getting customers:', event.target.error);
        callback([]);
    };
}

// Function to get vehicles for dropdown
function getVehicles(callback) {
    if (!db) {
        console.error('Database not available');
        callback([]);
        return;
    }
    
    const transaction = db.transaction(['vehicles'], 'readonly');
    const store = transaction.objectStore('vehicles');
    const request = store.getAll();

    request.onsuccess = () => {
        console.log('Retrieved vehicles:', request.result);
        callback(request.result);
    };
    
    request.onerror = (event) => {
        console.error('Error getting vehicles:', event.target.error);
        callback([]);
    };
}

// --- Sorting Logic ---
function sortTrips(trips, sortBy) {
    switch (sortBy) {
        case 'customer':
            // Sort by customer name (A-Z), then by date (Newest First)
            return trips.sort((a, b) => {
                const customerCompare = (a.customer || '').localeCompare(b.customer || '');
                if (customerCompare !== 0) {
                    return customerCompare;
                }
                // If customers are the same, sort by date descending
                return new Date(b.date) - new Date(a.date);
            });
        case 'user':
            // Sort by user name (A-Z), then by date (Newest First)
            return trips.sort((a, b) => {
                const userCompare = (a.user || '').localeCompare(b.user || '');
                if (userCompare !== 0) {
                    return userCompare;
                }
                // If users are the same, sort by date descending
                return new Date(b.date) - new Date(a.date);
            });
        case 'vehicle':
            // Sort by vehicle name (A-Z), then by date (Newest First)
            return trips.sort((a, b) => {
                const vehicleCompare = (a.vehicle || '').localeCompare(b.vehicle || '');
                if (vehicleCompare !== 0) {
                    return vehicleCompare;
                }
                // If vehicles are the same, sort by date descending
                return new Date(b.date) - new Date(a.date);
            });
        case 'date':
        default:
            // Default sort by date (Newest First)
            return trips.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
}

// --- UI Display ---
function displayTripsTable(trips) {
    console.log('TripSheet: displayTripsTable called with trips:', trips);
    const container = document.getElementById('tripsListContainer');
    container.innerHTML = '';

    if (!trips || trips.length === 0) {
        console.log('TripSheet: No trips found to display.');
        container.innerHTML = '<p class="no-trips-message">No trips recorded yet.</p>';
        return;
    }

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    // Create table header (Change 'Total' to 'KM')
    const headerRow = document.createElement('tr');
    const headers = ['Date', 'User', 'Vehicle', 'KM', 'Customer', 'Purpose', 'Actions']; // Changed 'Total' to 'KM'
    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    // Create table body
    trips.sort((a, b) => new Date(b.date) - new Date(a.date));

    trips.forEach(trip => {
        const row = document.createElement('tr');
        row.dataset.tripId = trip.id; // Store trip ID on the row

        const totalKm = (trip.endKm && trip.startKm) ? (trip.endKm - trip.startKm) : 'N/A';
        const formattedDate = trip.date ? new Date(trip.date).toLocaleDateString() : 'N/A';

        // Create cells (Remove startKmCell and endKmCell)
        const dateCell = document.createElement('td');
        dateCell.textContent = formattedDate;
        row.appendChild(dateCell);

        const userCell = document.createElement('td');
        userCell.textContent = trip.user ?? 'N/A';
        row.appendChild(userCell);

        const vehicleCell = document.createElement('td');
        vehicleCell.textContent = trip.vehicle ?? 'N/A';
        row.appendChild(vehicleCell);

        // REMOVED startKmCell creation
        // REMOVED endKmCell creation

        const totalKmCell = document.createElement('td');
        totalKmCell.textContent = totalKm;
        totalKmCell.classList.add('total-km-cell');
        // Add click listener to open the modal
        totalKmCell.addEventListener('click', () => {
            // Get the trip ID from the row
            const clickedTripId = parseInt(row.dataset.tripId);
            // Find the trip data
            const clickedTrip = allTrips.find(t => t.id === clickedTripId);
            if (clickedTrip) {
                openKmDetailsModal(clickedTrip.startKm, clickedTrip.endKm);
            } else {
                console.error('Could not find trip data for ID:', clickedTripId);
                // Optionally show default values or an error in the modal
                openKmDetailsModal('Error', 'Error');
            }
        });
        row.appendChild(totalKmCell);

        const customerCell = document.createElement('td');
        customerCell.textContent = trip.customer ?? 'N/A';
        row.appendChild(customerCell);

        const purposeCell = document.createElement('td');
        purposeCell.textContent = trip.purpose ?? 'N/A';
        row.appendChild(purposeCell);

        // Add Manage button
        const actionCell = document.createElement('td');
        const manageButton = document.createElement('button');
        manageButton.textContent = 'Manage';
        manageButton.className = 'btn btn-small btn-manage';
        manageButton.dataset.tripId = trip.id;
        manageButton.addEventListener('click', function() {
            handleManageTrip(trip.id);
        });
        actionCell.appendChild(manageButton);
        row.appendChild(actionCell);

        tbody.appendChild(row);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    container.appendChild(table);
    console.log('TripSheet: Table rendered.');
}

function displayErrorMessage(message) {
    console.error('TripSheet: Displaying error message:', message); // Log error display
    const container = document.getElementById('tripsListContainer');
    container.innerHTML = `<p class="alert">${message}</p>`;
}

// --- Event Handler for Sort Change ---
function handleSortChange() {
    if (!sortSelectElement) return;
    const sortBy = sortSelectElement.value;
    console.log(`TripSheet: Sort changed to ${sortBy}`);
    const sortedTrips = sortTrips([...allTrips], sortBy); // Sort a copy of the stored trips
    displayTripsTable(sortedTrips); // Re-render the table with sorted data
}

// --- Initial Load ---
// This function is now called after the delay in request.onsuccess
function loadAndDisplayTrips() {
    console.log('TripSheet: loadAndDisplayTrips called.'); // Log initial load
    getTrips((trips) => {
        allTrips = trips; // Store fetched trips globally
        const initialSortBy = sortSelectElement ? sortSelectElement.value : 'date'; // Get initial sort value
        const sortedTrips = sortTrips([...allTrips], initialSortBy); // Sort initially
        displayTripsTable(sortedTrips); // Render the sorted table
    });
}

// Function to handle when a manage button is clicked
function handleManageTrip(tripId) {
    console.log(`Managing trip with ID: ${tripId}`);
    
    const trip = allTrips.find(t => t.id === tripId);
    if (trip) {
        // Set values in the modal
        document.getElementById('manageTripId').value = tripId;
        document.getElementById('manageTripDate').value = new Date(trip.date).toLocaleDateString();
        
        // Show the modal
        const modal = document.getElementById('manageActionModal');
        modal.style.display = 'block';
    }
}

// Function to delete a trip
function deleteTrip(tripId) {
    if (!db) {
        console.error('Database not available');
        return;
    }
    
    const transaction = db.transaction(['trips'], 'readwrite');
    const store = transaction.objectStore('trips');
    const request = store.delete(tripId);
    
    request.onsuccess = () => {
        console.log(`Trip ${tripId} deleted successfully`);
        // Reload trips after deletion
        loadAndDisplayTrips();
    };
    
    request.onerror = (event) => {
        console.error(`Error deleting trip ${tripId}:`, event.target.error);
        alert('Failed to delete trip. Please try again.');
    };
}

// Function to populate customer dropdown
function populateCustomerDropdown(selectElement, selectedCustomer = null) {
    getCustomers((customers) => {
        // Clear existing options except the default
        selectElement.innerHTML = '<option value="">-- Select Customer --</option>';
        
        if (customers && customers.length > 0) {
            customers.forEach(customer => {
                const option = document.createElement('option');
                option.value = customer.name;
                option.textContent = customer.name;
                selectElement.appendChild(option);
            });
            
            // Set selected value if provided
            if (selectedCustomer) {
                selectElement.value = selectedCustomer;
            }
        }
    });
}

// Function to populate vehicle dropdown
function populateVehicleDropdown(selectElement, selectedVehicle = null) {
    getVehicles((vehicles) => {
        // Clear existing options except the default
        selectElement.innerHTML = '<option value="">-- Select Vehicle --</option>';
        
        if (vehicles && vehicles.length > 0) {
            vehicles.forEach(vehicle => {
                const option = document.createElement('option');
                option.value = vehicle.name;
                option.textContent = vehicle.name;
                selectElement.appendChild(option);
            });
            
            // Set selected value if provided
            if (selectedVehicle) {
                selectElement.value = selectedVehicle;
            }
        }
    });
}

// Function to open edit trip modal
function openEditTripModal(tripId) {
    const trip = allTrips.find(t => t.id === tripId);
    if (!trip) {
        console.error('Trip not found:', tripId);
        return;
    }
    
    // Populate the edit form with trip data
    document.getElementById('editTripId').value = tripId;
    document.getElementById('editTripDate').value = trip.date;
    document.getElementById('editTripStartKm').value = trip.startKm || '';
    document.getElementById('editEndKmInput').value = trip.endKm || '';
    document.getElementById('editPurposeInput').value = trip.purpose || '';
    document.getElementById('editWorkDetailsTextarea').value = trip.workDetails || '';
    
    // Set the user dropdown value
    const userSelect = document.getElementById('editUserSelect');
    if (userSelect) {
        userSelect.value = trip.user || '';
    }
    
    // Populate customer dropdown and set value
    const customerSelect = document.getElementById('editCustomerSelect');
    if (customerSelect) {
        populateCustomerDropdown(customerSelect, trip.customer);
    }
    
    // Populate vehicle dropdown and set value
    const vehicleSelect = document.getElementById('editVehicleSelect');
    if (vehicleSelect) {
        populateVehicleDropdown(vehicleSelect, trip.vehicle);
    }
    
    // Show the edit modal
    const modal = document.getElementById('editTripModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

// Function to save edited trip
function saveEditedTrip() {
    if (!db) {
        console.error('Database not available');
        return;
    }
    
    const tripId = parseInt(document.getElementById('editTripId').value);
    if (!tripId) {
        console.error('Invalid trip ID');
        return;
    }
    
    // Get original trip data
    const original = allTrips.find(t => t.id === tripId);
    if (!original) {
        console.error('Original trip not found');
        return;
    }
    
    const updatedTrip = {
        id: tripId,
        date: document.getElementById('editTripDate').value,
        startKm: parseInt(document.getElementById('editTripStartKm').value),
        endKm: parseInt(document.getElementById('editEndKmInput').value),
        purpose: document.getElementById('editPurposeInput').value,
        workDetails: document.getElementById('editWorkDetailsTextarea').value,
        user: document.getElementById('editUserSelect').value,
        customer: document.getElementById('editCustomerSelect').value,
        vehicle: document.getElementById('editVehicleSelect').value
    };
    
    // Validate fields
    if (!updatedTrip.user || !updatedTrip.vehicle || !updatedTrip.customer || !updatedTrip.endKm) {
        alert('Please fill in all required fields');
        return;
    }
    
    // Update in DB
    const transaction = db.transaction(['trips'], 'readwrite');
    const store = transaction.objectStore('trips');
    const request = store.put(updatedTrip);
    
    request.onsuccess = () => {
        console.log('Trip updated successfully:', tripId);
        // Hide modal and reload data
        document.getElementById('editTripModal').style.display = 'none';
        loadAndDisplayTrips();
    };
    
    request.onerror = (event) => {
        console.error('Error updating trip:', event.target.error);
        alert('Failed to update trip. Please try again.');
    };
}

// --- KM Details Modal Functions ---
function openKmDetailsModal(startKm, endKm) {
    if (!kmDetailsModal || !modalStartKmValue || !modalEndKmValue) {
        console.error('KM Details Modal elements not found.');
        return;
    }
    modalStartKmValue.textContent = startKm ?? 'N/A';
    modalEndKmValue.textContent = endKm ?? 'N/A';
    kmDetailsModal.style.display = 'block';
}

function closeKmDetailsModal() {
    if (kmDetailsModal) {
        kmDetailsModal.style.display = 'none';
    }
}

// Add event listeners for manage modal buttons AND KM Details Modal
document.addEventListener('DOMContentLoaded', () => {
    // Get KM Details Modal elements
    kmDetailsModal = document.getElementById('kmDetailsModal');
    closeKmModalBtn = document.getElementById('closeKmModalBtn');
    modalStartKmValue = document.getElementById('modalStartKmValue');
    modalEndKmValue = document.getElementById('modalEndKmValue');

    // KM Details Modal close button
    if (closeKmModalBtn) {
        closeKmModalBtn.addEventListener('click', closeKmDetailsModal);
    }

    // Manage Action Modal close button
    const closeManageModalBtn = document.getElementById('closeManageModalBtn');
    if (closeManageModalBtn) {
        closeManageModalBtn.addEventListener('click', () => {
            document.getElementById('manageActionModal').style.display = 'none';
        });
    }

    // Edit button (Manage Modal)
    const manageEditBtn = document.getElementById('manageEditBtn');
    if (manageEditBtn) {
        manageEditBtn.addEventListener('click', () => {
            const tripId = parseInt(document.getElementById('manageTripId').value);
            document.getElementById('manageActionModal').style.display = 'none';
            openEditTripModal(tripId);
        });
    }

    // Delete button (Manage Modal)
    const manageDeleteBtn = document.getElementById('manageDeleteBtn');
    if (manageDeleteBtn) {
        manageDeleteBtn.addEventListener('click', () => {
            const tripId = parseInt(document.getElementById('manageTripId').value);
            const tripDate = document.getElementById('manageTripDate').value;
            if (confirm(`Are you sure you want to delete this trip from ${tripDate}?`)) {
                deleteTrip(tripId);
                document.getElementById('manageActionModal').style.display = 'none';
            }
        });
    }

    // Cancel button (Manage Modal)
    const manageCancelBtn = document.getElementById('manageCancelBtn');
    if (manageCancelBtn) {
        manageCancelBtn.addEventListener('click', () => {
            document.getElementById('manageActionModal').style.display = 'none';
        });
    }

    // Edit Trip Modal Event Listeners
    const closeEditModalBtn = document.getElementById('closeEditModalBtn');
    if (closeEditModalBtn) {
        closeEditModalBtn.addEventListener('click', () => {
            document.getElementById('editTripModal').style.display = 'none';
        });
    }

    const saveTripEditBtn = document.getElementById('saveTripEditBtn');
    if (saveTripEditBtn) {
        saveTripEditBtn.addEventListener('click', saveEditedTrip);
    }

    const cancelTripEditBtn = document.getElementById('cancelTripEditBtn');
    if (cancelTripEditBtn) {
        cancelTripEditBtn.addEventListener('click', () => {
            document.getElementById('editTripModal').style.display = 'none';
        });
    }

    // Close modals if clicked outside the content area
    window.addEventListener('click', (event) => {
        if (event.target === document.getElementById('manageActionModal')) {
            document.getElementById('manageActionModal').style.display = 'none';
        }
        if (event.target === document.getElementById('editTripModal')) {
            document.getElementById('editTripModal').style.display = 'none';
        }
        // Add check for the new KM Details modal
        if (event.target === kmDetailsModal) {
            closeKmDetailsModal();
        }
    });
}); 