let db;
let allTrips = []; // Variable to store fetched trips
let sortSelectElement; // Reference to the dropdown
let kmDetailsModal, closeKmModalBtn, modalStartKmValue, modalEndKmValue; // Add variables for the new modal elements
let currentFilter = 'all'; // NEW: Variable to track the current filter ('all', 'travel', 'office')
let filterAllBtn, filterTravelBtn, filterOfficeBtn; // NEW: References for filter buttons

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

    // NEW: Get references to filter buttons
    filterAllBtn = document.getElementById('filterAllBtn');
    filterTravelBtn = document.getElementById('filterTravelBtn');
    filterOfficeBtn = document.getElementById('filterOfficeBtn');

    // NEW: Add event listeners for filter buttons
    if (filterAllBtn) filterAllBtn.addEventListener('click', () => setFilter('all'));
    if (filterTravelBtn) filterTravelBtn.addEventListener('click', () => setFilter('travel'));
    if (filterOfficeBtn) filterOfficeBtn.addEventListener('click', () => setFilter('office'));

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
function displayTripsTable(tripsToDisplay) { // Renamed parameter for clarity
    console.log('TripSheet: displayTripsTable called with trips:', tripsToDisplay);
    const container = document.getElementById('tripsListContainer');
    container.innerHTML = ''; // Clear previous content

    // Check the filtered list length
    if (!tripsToDisplay || tripsToDisplay.length === 0) {
        // Display a message appropriate to the filter
        let message = 'No trips recorded yet.';
        if (currentFilter === 'travel') {
            message = 'No travel trips match the current filter.';
        } else if (currentFilter === 'office') {
            message = 'No office work entries match the current filter.';
        } else if (allTrips.length > 0) {
             // This case shouldn't happen if filtering logic is correct, but good fallback
             message = 'No trips match the current filter/sort criteria.';
        }
        console.log('TripSheet: No trips found to display for the current filter.');
        container.innerHTML = `<p class="no-trips-message">${message}</p>`;
        return;
    }

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    // Create table header (Change 'Total' to 'KM')
    const headerRow = document.createElement('tr');
    // Adjust headers based on type? For now, keep consistent.
    // Consider hiding 'Car'/'KM' for office entries if desired later.
    const headers = ['Date', 'User', 'Car', 'KM', 'Customer', 'Purpose', 'Actions'];
    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    // Create table body using the provided tripsToDisplay
    tripsToDisplay.forEach(trip => {
        const row = document.createElement('tr');
        row.dataset.tripId = trip.id; // Store trip ID on the row

        // Handle potential null/undefined values gracefully
        const isTravel = trip.type === 'travel';
        const totalKm = isTravel && trip.endKm && trip.startKm ? (trip.endKm - trip.startKm) : (isTravel ? 'N/A' : '-'); // Show '-' for office KM
        const formattedDate = trip.date ? new Date(trip.date).toLocaleDateString() : 'N/A';

        // Create cells
        const dateCell = document.createElement('td');
        dateCell.textContent = formattedDate;
        row.appendChild(dateCell);

        const userCell = document.createElement('td');
        userCell.textContent = trip.user ?? 'N/A';
        row.appendChild(userCell);

        const vehicleCell = document.createElement('td');
        // Show '-' for office vehicle
        vehicleCell.textContent = isTravel ? (trip.vehicle ?? 'N/A') : '-';
        row.appendChild(vehicleCell);

        const totalKmCell = document.createElement('td');
        totalKmCell.textContent = totalKm;
        if (isTravel && totalKm !== 'N/A' && totalKm !== '-') { // Only make travel KM clickable
             totalKmCell.classList.add('total-km-cell'); // Add class for potential styling/cursor
             totalKmCell.addEventListener('click', () => {
                const clickedTripId = parseInt(row.dataset.tripId);
                const clickedTrip = allTrips.find(t => t.id === clickedTripId);
                if (clickedTrip) {
                    openKmDetailsModal(clickedTrip.startKm, clickedTrip.endKm);
                } else {
                    console.error('Could not find trip data for ID:', clickedTripId);
                    openKmDetailsModal('Error', 'Error');
                }
            });
        } else {
            totalKmCell.style.cursor = 'default'; // Ensure non-clickable look
        }
        row.appendChild(totalKmCell);

        const customerCell = document.createElement('td');
        customerCell.textContent = trip.customer ?? 'N/A';
        row.appendChild(customerCell);

        const purposeCell = document.createElement('td');
        purposeCell.textContent = trip.purpose ?? 'N/A';
        // Optionally add work details tooltip or similar here later
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
    // Apply current filter AND new sort
    displayFilteredAndSortedTrips();
}

// --- Initial Load ---
// This function is now called after the delay in request.onsuccess
function loadAndDisplayTrips() {
    console.log('TripSheet: loadAndDisplayTrips called.'); // Log initial load
    getTrips((trips) => {
        allTrips = trips; // Store fetched trips globally
        // Apply initial filter ('all' by default) and sort
        displayFilteredAndSortedTrips();
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
        // Remove deleted trip from the local 'allTrips' array
        allTrips = allTrips.filter(t => t.id !== tripId);
        // Reload trips using the current filter/sort
        displayFilteredAndSortedTrips(); // Use the combined function
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
        // Update the trip in the local 'allTrips' array
        const index = allTrips.findIndex(t => t.id === tripId);
        if (index !== -1) {
            allTrips[index] = updatedTrip;
        } else {
            // Should not happen if editing existing, but maybe add it just in case
            allTrips.push(updatedTrip);
        }
        // Hide modal and reload data using current filter/sort
        document.getElementById('editTripModal').style.display = 'none';
        displayFilteredAndSortedTrips(); // Use the combined function
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

// --- NEW: Function to set the current filter and update UI ---
function setFilter(filterType) {
    currentFilter = filterType;
    console.log(`TripSheet: Filter set to ${currentFilter}`);

    // Update button active states
    [filterAllBtn, filterTravelBtn, filterOfficeBtn].forEach(btn => {
        if (btn) btn.classList.remove('active-filter');
    });
    if (filterType === 'all' && filterAllBtn) filterAllBtn.classList.add('active-filter');
    if (filterType === 'travel' && filterTravelBtn) filterTravelBtn.classList.add('active-filter');
    if (filterType === 'office' && filterOfficeBtn) filterOfficeBtn.classList.add('active-filter');

    // Re-display the table with the new filter applied
    displayFilteredAndSortedTrips();
}

// --- NEW: Function to apply filter and sort, then display ---
function displayFilteredAndSortedTrips() {
    console.log(`TripSheet: Filtering by '${currentFilter}' and sorting by '${sortSelectElement ? sortSelectElement.value : 'date'}'`);

    // 1. Filter
    let filteredTrips = allTrips;
    if (currentFilter === 'travel') {
        filteredTrips = allTrips.filter(trip => trip.type === 'travel');
    } else if (currentFilter === 'office') {
        // Ensure 'office' type exists, otherwise default to showing none if type is missing/null
        filteredTrips = allTrips.filter(trip => trip.type === 'office');
    }
    // 'all' filter doesn't need explicit filtering step

    // 2. Sort
    const sortBy = sortSelectElement ? sortSelectElement.value : 'date';
    const sortedTrips = sortTrips([...filteredTrips], sortBy); // Sort the filtered list

    // 3. Display
    displayTripsTable(sortedTrips);
} 