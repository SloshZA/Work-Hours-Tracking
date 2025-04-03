let db;

const request = indexedDB.open('TripTrackerDB', 4);

request.onupgradeneeded = (event) => {
    console.log('Vehicles: DB upgrade needed.');
    const dbInstance = event.target.result;
    // Add checks for consistency
    if (!dbInstance.objectStoreNames.contains('vehicles')) {
        const vehicleStore = dbInstance.createObjectStore('vehicles', { keyPath: 'id', autoIncrement: true });
        if (!vehicleStore.indexNames.contains('name')) {
             vehicleStore.createIndex('name', 'name', { unique: true });
        }
    } else {
        const transaction = event.target.transaction;
        const vehicleStore = transaction.objectStore('vehicles');
        if (!vehicleStore.indexNames.contains('name')) {
             vehicleStore.createIndex('name', 'name', { unique: true });
        }
    }
     // You might want to ensure other stores are checked here too for robustness
    // if (!dbInstance.objectStoreNames.contains('trips')) { ... }
    // if (!dbInstance.objectStoreNames.contains('customers')) { ... }
    // if (!dbInstance.objectStoreNames.contains('preferences')) { ... }
};

request.onsuccess = (event) => {
    db = event.target.result;
    console.log('Vehicles: Database opened successfully.');
    loadVehicles();
    setupEventListeners();
};

request.onerror = (event) => {
    console.error('Vehicles: Error opening database:', event.target.error);
    // Display an error message to the user on the page
    const container = document.getElementById('vehicleListContainer');
    if (container) {
        container.innerHTML = '<p class="alert">Could not connect to the database.</p>';
    }
};

function saveVehicle(vehicle, callback) {
    if (!db) {
        console.error('Database not initialized.');
        alert('Database error. Cannot save vehicle.');
        return;
    }
    
    const transaction = db.transaction(['vehicles'], 'readwrite');
    const store = transaction.objectStore('vehicles');
    
    // For existing vehicles (edit mode)
    let request;
    if (vehicle.id) {
        request = store.put(vehicle);
    } else {
        request = store.add(vehicle);
    }
    
    request.onsuccess = () => {
        console.log('Vehicle saved successfully');
        if (callback) callback(true);
    };
    
    request.onerror = (event) => {
        console.error('Error saving vehicle:', event.target.error);
        if (callback) callback(false);
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

function deleteVehicle(id, callback) {
    if (!db) {
        console.error('Database not initialized.');
        alert('Database error. Cannot delete vehicle.');
        return;
    }
    
    const transaction = db.transaction(['vehicles'], 'readwrite');
    const store = transaction.objectStore('vehicles');
    const request = store.delete(id);
    
    request.onsuccess = () => {
        console.log('Vehicle deleted successfully');
        if (callback) callback(true);
    };
    
    request.onerror = (event) => {
        console.error('Error deleting vehicle:', event.target.error);
        if (callback) callback(false);
    };
}

function loadVehicles() {
    getVehicles((vehicles) => {
        const container = document.getElementById('vehiclesListContainer');
        
        if (!vehicles || vehicles.length === 0) {
            container.innerHTML = '<p class="no-trips-message">No vehicles found. Add your first vehicle to get started.</p>';
            return;
        }
        
        // Sort by name for easier reading
        vehicles.sort((a, b) => a.name.localeCompare(b.name));
        
        let html = `
            <table class="customer-table">
                <thead>
                    <tr>
                        <th>Vehicle</th>
                        <th>License Plate</th>
                        <th>Current KM</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        vehicles.forEach(vehicle => {
            html += `
                <tr>
                    <td>${vehicle.name || ''}</td>
                    <td>${vehicle.licensePlate || ''}</td>
                    <td>${vehicle.currentKm || ''}</td>
                    <td>
                        <button class="btn btn-small btn-manage" 
                            data-id="${vehicle.id}" 
                            data-name="${vehicle.name}">
                            Manage
                        </button>
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        container.innerHTML = html;
        
        // Attach event listeners to the manage buttons
        document.querySelectorAll('.btn-manage').forEach(button => {
            button.addEventListener('click', handleManageClick);
        });
    });
}

function setupEventListeners() {
    // Add Vehicle button
    document.getElementById('addVehicleBtn').addEventListener('click', () => {
        openModal();
    });
    
    // Save Vehicle button
    document.getElementById('saveVehicleBtn').addEventListener('click', handleSaveVehicle);
    
    // Close modal buttons
    document.getElementById('closeModalBtn').addEventListener('click', closeModal);
    document.getElementById('closeManageModalBtn').addEventListener('click', closeManageModal);
    
    // Manage modal actions
    document.getElementById('manageEditBtn').addEventListener('click', handleEditClick);
    document.getElementById('manageDeleteBtn').addEventListener('click', handleDeleteClick);
    document.getElementById('manageCancelBtn').addEventListener('click', closeManageModal);
    
    // Close modals when clicking outside
    window.addEventListener('click', (event) => {
        const vehicleModal = document.getElementById('vehicleModal');
        const manageModal = document.getElementById('manageActionModal');
        
        if (event.target === vehicleModal) {
            closeModal();
        } else if (event.target === manageModal) {
            closeManageModal();
        }
    });
}

function openModal(vehicleId = null) {
    // Reset the form
    document.getElementById('vehicleId').value = '';
    document.getElementById('vehicleName').value = '';
    document.getElementById('licensePlate').value = '';
    document.getElementById('currentKm').value = '';
    
    document.getElementById('modalTitle').textContent = 'Add New Vehicle';
    
    // If vehicleId is provided, we're in edit mode
    if (vehicleId) {
        document.getElementById('modalTitle').textContent = 'Edit Vehicle';
        loadVehicleDetails(vehicleId);
    }
    
    document.getElementById('vehicleModal').style.display = 'block';
}

function loadVehicleDetails(vehicleId) {
    if (!db) return;
    
    const transaction = db.transaction(['vehicles'], 'readonly');
    const store = transaction.objectStore('vehicles');
    const request = store.get(vehicleId);
    
    request.onsuccess = () => {
        const vehicle = request.result;
        if (vehicle) {
            document.getElementById('vehicleId').value = vehicle.id;
            document.getElementById('vehicleName').value = vehicle.name || '';
            document.getElementById('licensePlate').value = vehicle.licensePlate || '';
            document.getElementById('currentKm').value = vehicle.currentKm || '';
        }
    };
    
    request.onerror = (event) => {
        console.error('Error loading vehicle details:', event.target.error);
    };
}

function closeModal() {
    document.getElementById('vehicleModal').style.display = 'none';
}

function openManageModal(vehicleId, vehicleName) {
    document.getElementById('manageVehicleId').value = vehicleId;
    document.getElementById('manageVehicleName').value = vehicleName;
    document.getElementById('manageModalTitle').textContent = `Manage Vehicle: ${vehicleName}`;
    document.getElementById('manageActionModal').style.display = 'block';
}

function closeManageModal() {
    document.getElementById('manageActionModal').style.display = 'none';
}

function handleManageClick(event) {
    const vehicleId = parseInt(event.currentTarget.dataset.id);
    const vehicleName = event.currentTarget.dataset.name;
    openManageModal(vehicleId, vehicleName);
}

function handleEditClick() {
    const vehicleId = parseInt(document.getElementById('manageVehicleId').value);
    closeManageModal();
    openModal(vehicleId);
}

function handleDeleteClick() {
    const vehicleId = parseInt(document.getElementById('manageVehicleId').value);
    const vehicleName = document.getElementById('manageVehicleName').value;
    
    if (confirm(`Are you sure you want to delete the vehicle "${vehicleName}"?`)) {
        deleteVehicle(vehicleId, (success) => {
            if (success) {
                closeManageModal();
                loadVehicles(); // Refresh the list
                alert('Vehicle deleted successfully');
            } else {
                alert('Failed to delete vehicle');
            }
        });
    }
}

function handleSaveVehicle() {
    const vehicleId = document.getElementById('vehicleId').value;
    const name = document.getElementById('vehicleName').value.trim();
    const licensePlate = document.getElementById('licensePlate').value.trim();
    const currentKm = document.getElementById('currentKm').value.trim();
    
    if (!name) {
        alert('Vehicle name is required');
        return;
    }
    
    if (!licensePlate) {
        alert('License plate number is required');
        return;
    }
    
    if (!currentKm) {
        alert('Current KM is required');
        return;
    }
    
    const vehicle = {
        name,
        licensePlate,
        currentKm: parseInt(currentKm)
    };
    
    // If we're editing an existing vehicle, add the ID
    if (vehicleId) {
        vehicle.id = parseInt(vehicleId);
    }
    
    saveVehicle(vehicle, (success) => {
        if (success) {
            closeModal();
            loadVehicles(); // Refresh the list
            alert('Vehicle saved successfully');
        } else {
            alert('Failed to save vehicle');
        }
    });
} 