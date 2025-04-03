let db;
let allCustomers = [];
let allTrips = []; // Needed for last visited date

// --- IndexedDB Setup ---
const request = indexedDB.open('TripTrackerDB', 4);

request.onupgradeneeded = (event) => {
    console.log('Customers: DB upgrade needed.');
    const dbInstance = event.target.result;
    // Add checks for consistency, though javascript.js likely creates these
    if (!dbInstance.objectStoreNames.contains('customers')) {
        const customerStore = dbInstance.createObjectStore('customers', { keyPath: 'id', autoIncrement: true });
        if (!customerStore.indexNames.contains('name')) {
             customerStore.createIndex('name', 'name', { unique: false });
        }
    } else {
        const transaction = event.target.transaction;
        const customerStore = transaction.objectStore('customers');
        if (!customerStore.indexNames.contains('name')) {
             customerStore.createIndex('name', 'name', { unique: false });
        }
    }
    // You might want to ensure other stores are checked here too for robustness
    // if (!dbInstance.objectStoreNames.contains('trips')) { ... }
    // if (!dbInstance.objectStoreNames.contains('vehicles')) { ... }
    // if (!dbInstance.objectStoreNames.contains('preferences')) { ... }
};

request.onsuccess = (event) => {
    db = event.target.result;
    console.log('Customers: Database opened successfully.');
    loadInitialData();
    setupEventListeners(); // Setup button listeners etc.
};

request.onerror = (event) => {
    console.error('Customers: Error opening database:', event.target.error);
    displayErrorMessage('Could not load customer data. Database error.');
};

// --- Data Fetching ---
function getCustomers(callback) {
    if (!db) return callback([]);
    try {
        const transaction = db.transaction(['customers'], 'readonly');
        const store = transaction.objectStore('customers');
        const request = store.getAll();
        request.onsuccess = () => callback(request.result);
        request.onerror = (event) => {
            console.error('Customers: Error getting customers:', event.target.error);
            callback([]);
        };
    } catch (error) {
        console.error('Customers: Error creating getCustomers transaction:', error);
        callback([]);
    }
}

function getTrips(callback) {
    if (!db) return callback([]);
    try {
        const transaction = db.transaction(['trips'], 'readonly');
        const store = transaction.objectStore('trips');
        const request = store.getAll();
        request.onsuccess = () => callback(request.result);
        request.onerror = (event) => {
            console.error('Customers: Error getting trips:', event.target.error);
            callback([]);
        };
    } catch (error) {
        console.error('Customers: Error creating getTrips transaction:', error);
        callback([]);
    }
}

function saveCustomer(customer, callback) {
    if (!db) return callback(false);
    try {
        const transaction = db.transaction(['customers'], 'readwrite');
        const store = transaction.objectStore('customers');
        const request = store.add(customer);
        transaction.oncomplete = () => callback(true);
        transaction.onerror = (event) => {
            console.error('Customers: Error saving customer transaction:', event.target.error);
            callback(false);
        };
        request.onerror = (event) => {
             console.error('Customers: Error saving customer request:', event.target.error);
             // Transaction error will likely catch this anyway
        };
    } catch (error) {
        console.error('Customers: Error creating saveCustomer transaction:', error);
        callback(false);
    }
}

function updateCustomer(customer, callback) {
    if (!db || !customer.id) return callback(false);
    try {
        const transaction = db.transaction(['customers'], 'readwrite');
        const store = transaction.objectStore('customers');
        const request = store.put(customer);
        transaction.oncomplete = () => callback(true);
        transaction.onerror = (event) => {
            console.error('Customers: Error updating customer transaction:', event.target.error);
            callback(false);
        };
        request.onerror = (event) => {
             console.error('Customers: Error updating customer request:', event.target.error);
        };
    } catch (error) {
        console.error('Customers: Error creating updateCustomer transaction:', error);
        callback(false);
    }
}

function deleteCustomer(customerId, callback) {
    if (!db) return callback(false);
    try {
        const transaction = db.transaction(['customers'], 'readwrite');
        const store = transaction.objectStore('customers');
        const request = store.delete(customerId); // Use the customer ID as the key

        transaction.oncomplete = () => {
            console.log(`Customer with ID ${customerId} deleted.`);
            callback(true);
        };
        transaction.onerror = (event) => {
            console.error('Customers: Error deleting customer transaction:', event.target.error);
            callback(false);
        };
        request.onerror = (event) => {
             console.error('Customers: Error deleting customer request:', event.target.error);
             // Transaction error will likely catch this anyway
        };
    } catch (error) {
        console.error('Customers: Error creating deleteCustomer transaction:', error);
        callback(false);
    }
}

// --- Helper Functions ---
function calculateLastVisited(customerName, trips) {
    const customerTrips = trips
        .filter(trip => trip.customer === customerName && trip.date)
        .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort descending by date

    return customerTrips.length > 0 ? new Date(customerTrips[0].date).toLocaleDateString() : 'N/A';
}

function createContactPairElement(person = '', number = '', canRemove = true) {
    const div = document.createElement('div');
    div.classList.add('contact-pair');

    const personInput = document.createElement('input');
    personInput.type = 'text';
    personInput.classList.add('contactPerson');
    personInput.placeholder = 'Contact Person';
    personInput.value = person;

    const numberInput = document.createElement('input');
    numberInput.type = 'text'; // Use text for flexibility (e.g., extensions)
    numberInput.classList.add('contactNumber');
    numberInput.placeholder = 'Contact Number';
    numberInput.value = number;

    div.appendChild(personInput);
    div.appendChild(numberInput);

    if (canRemove) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = 'X';
        removeBtn.classList.add('btn-remove-contact');
        removeBtn.addEventListener('click', () => {
            div.remove(); // Remove the entire contact-pair div
        });
        div.appendChild(removeBtn);
    }

    return div;
}

// --- UI Display ---
function displayCustomersTable(customers, trips) {
    const container = document.getElementById('customersListContainer');
    container.innerHTML = ''; // Clear loading message

    if (!customers || customers.length === 0) {
        container.innerHTML = '<p class="no-trips-message">No customers added yet.</p>';
        return;
    }

    // Sort customers alphabetically by name
    customers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const table = document.createElement('table');
    table.classList.add('customer-table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    // Create table header
    const headerRow = document.createElement('tr');
    const headers = ['Name', 'Contact Person', 'Contact Number', 'Address', 'Last Visited', 'Actions'];
    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    // Create table body
    customers.forEach(customer => {
        const row = document.createElement('tr');
        const lastVisited = calculateLastVisited(customer.name, trips);

        // --- Create Cells ---
        const nameTd = document.createElement('td');
        nameTd.textContent = customer.name ?? 'N/A';
        nameTd.classList.add('td-name');
        row.appendChild(nameTd);

        const contactPersonTd = document.createElement('td');
        contactPersonTd.classList.add('td-contact-person');
        const contactNumberTd = document.createElement('td');
        contactNumberTd.classList.add('td-contact-number');

        const contacts = customer.contacts || [];
        if (contacts.length === 0) {
            contactPersonTd.textContent = 'N/A';
            contactNumberTd.textContent = 'N/A';
        } else if (contacts.length === 1) {
            contactPersonTd.textContent = contacts[0].person || 'N/A';
            contactNumberTd.textContent = contacts[0].number || 'N/A';
        } else {
            const select = document.createElement('select');
            select.classList.add('contact-person-dropdown');
            contacts.forEach((contact, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = contact.person || `Contact ${index + 1}`;
                select.appendChild(option);
            });
            contactNumberTd.textContent = contacts[0].number || 'N/A';
            select.addEventListener('change', (event) => {
                const selectedIndex = parseInt(event.target.value, 10);
                contactNumberTd.textContent = contacts[selectedIndex]?.number || 'N/A';
            });
            contactPersonTd.appendChild(select);
        }
        row.appendChild(contactPersonTd);
        row.appendChild(contactNumberTd);

        // Address Cell
        const addressTd = document.createElement('td');
        const addressValue = customer.address ?? '';
        if (addressValue.startsWith('http://') || addressValue.startsWith('https://')) {
            const mapLink = document.createElement('a');
            mapLink.href = '#'; // Keep href as '#'
            mapLink.dataset.url = addressValue; // Store URL in data attribute
            mapLink.textContent = 'Open Maps';
            mapLink.classList.add('map-link');

            // MODIFIED: Open the choice modal instead of confirm()
            mapLink.addEventListener('click', (event) => {
                event.preventDefault(); // Prevent '#' navigation
                const url = event.target.dataset.url;
                if (url) {
                    openMapChoiceModal(url); // Call the function to open the new modal
                } else {
                    console.error('Map link URL not found in data attribute.');
                }
            });

            addressTd.appendChild(mapLink);
        } else {
            addressTd.textContent = addressValue || 'N/A';
        }
        row.appendChild(addressTd);

        // Last Visited Cell
        const lastVisitedTd = document.createElement('td');
        lastVisitedTd.textContent = lastVisited;
        lastVisitedTd.classList.add('td-last-visited');
        row.appendChild(lastVisitedTd);

        // Actions Cell
        const actionsTd = document.createElement('td');
        const manageBtn = document.createElement('button');
        manageBtn.textContent = 'Manage';
        manageBtn.classList.add('btn', 'btn-small', 'btn-manage');
        manageBtn.dataset.customerId = customer.id;
        manageBtn.addEventListener('click', () => {
            openManageModal(customer.id, customer.name);
        });
        actionsTd.appendChild(manageBtn);
        row.appendChild(actionsTd);

        tbody.appendChild(row);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    container.appendChild(table);
}

function displayErrorMessage(message) {
    const container = document.getElementById('customersListContainer');
    container.innerHTML = `<p class="alert">${message}</p>`;
}

// --- Modal Handling ---
function openModalForAdd() {
    const modal = document.getElementById('customerModal');
    const contactsContainer = document.getElementById('contactsContainer');

    // Reset fields
    document.getElementById('modalTitle').textContent = 'Add New Customer';
    document.getElementById('customerId').value = ''; // Clear ID for adding
    document.getElementById('customerName').value = '';
    document.getElementById('customerAddress').value = '';
    document.getElementById('saveCustomerBtn').textContent = 'Save Customer';

    // Clear existing contact pairs and add one empty one
    contactsContainer.innerHTML = '';
    contactsContainer.appendChild(createContactPairElement('', '', false)); // First one cannot be removed

    modal.style.display = 'block';
}

function openModalForEdit(customer) {
    const modal = document.getElementById('customerModal');
    const contactsContainer = document.getElementById('contactsContainer');

    // Populate fields
    document.getElementById('modalTitle').textContent = 'Edit Customer';
    document.getElementById('customerId').value = customer.id; // Set ID for editing
    document.getElementById('customerName').value = customer.name ?? '';
    document.getElementById('customerAddress').value = customer.address ?? '';
    document.getElementById('saveCustomerBtn').textContent = 'Update Customer';

    // Clear existing contact pairs
    contactsContainer.innerHTML = '';

    // Add contact pairs from customer data
    if (customer.contacts && customer.contacts.length > 0) {
        customer.contacts.forEach((contact, index) => {
            // Only allow removal for contacts beyond the first one
            contactsContainer.appendChild(createContactPairElement(contact.person, contact.number, index > 0));
        });
    } else {
        // If no contacts exist, add one empty one that cannot be removed
        contactsContainer.appendChild(createContactPairElement('', '', false));
    }

    modal.style.display = 'block';
}

function closeModal() {
    const modal = document.getElementById('customerModal');
    modal.style.display = 'none';
}

function handleSaveOrUpdateCustomer() {
    const customerId = document.getElementById('customerId').value;
    const name = document.getElementById('customerName').value.trim();
    const address = document.getElementById('customerAddress').value.trim();
    const contactsContainer = document.getElementById('contactsContainer');
    const contactPairs = contactsContainer.querySelectorAll('.contact-pair');

    if (!name) {
        alert('Customer Name is required.');
        return;
    }

    const contacts = [];
    contactPairs.forEach(pair => {
        const personInput = pair.querySelector('.contactPerson');
        const numberInput = pair.querySelector('.contactNumber');
        const person = personInput.value.trim();
        const number = numberInput.value.trim();
        // Only add if at least a person or number is provided
        if (person || number) {
            contacts.push({ person, number });
        }
    });

    const customerData = {
        name,
        address,
        contacts // Store the array of contacts
    };

    if (customerId) {
        // --- Editing Existing Customer ---
        customerData.id = parseInt(customerId); // Ensure ID is included and is a number
        updateCustomer(customerData, (success) => {
            if (success) {
                alert('Customer updated successfully!');
                closeModal();
                loadInitialData(); // Refresh list
            } else {
                alert('Failed to update customer.');
            }
        });
    } else {
        // --- Adding New Customer ---
        saveCustomer(customerData, (success) => {
            if (success) {
                alert('Customer added successfully!');
                closeModal();
                loadInitialData(); // Refresh list
            } else {
                alert('Failed to save customer.');
            }
        });
    }
}

function handleDeleteCustomer(customerId, customerName) {
    // Confirm before deleting
    if (confirm(`Are you sure you want to delete customer "${customerName}"? This action cannot be undone.`)) {
        deleteCustomer(customerId, (success) => {
            if (success) {
                alert(`Customer "${customerName}" deleted successfully!`);
                loadInitialData(); // Reload the table to reflect the deletion
            } else {
                alert(`Failed to delete customer "${customerName}".`);
            }
        });
    }
}

function handleEditCustomer(customerId) {
    // Find the customer object from the locally stored list
    const customerToEdit = allCustomers.find(c => c.id === customerId);
    if (customerToEdit) {
        openModalForEdit(customerToEdit);
    } else {
        console.error(`Customer with ID ${customerId} not found in local list.`);
        alert('Could not find customer data to edit.');
    }
}

// --- NEW: Manage Action Modal Functions ---
function openManageModal(customerId, customerName) {
    const modal = document.getElementById('manageActionModal');
    document.getElementById('manageModalTitle').textContent = `Manage: ${customerName}`;
    document.getElementById('manageCustomerId').value = customerId;
    document.getElementById('manageCustomerName').value = customerName; // Store name too
    modal.style.display = 'block';
}

function closeManageModal() {
    const modal = document.getElementById('manageActionModal');
    modal.style.display = 'none';
    // Clear stored values (optional but good practice)
    document.getElementById('manageCustomerId').value = '';
    document.getElementById('manageCustomerName').value = '';
}

// --- NEW: Map Choice Modal Functions ---
function openMapChoiceModal(url) {
    const modal = document.getElementById('mapChoiceModal');
    const urlInput = document.getElementById('mapChoiceUrl');
    if (modal && urlInput) {
        urlInput.value = url; // Store the URL
        modal.style.display = 'block';
    } else {
        console.error('Map choice modal elements not found.');
    }
}

function closeMapChoiceModal() {
    const modal = document.getElementById('mapChoiceModal');
    const urlInput = document.getElementById('mapChoiceUrl');
    if (modal && urlInput) {
        modal.style.display = 'none';
        urlInput.value = ''; // Clear the stored URL
    }
}

function handleMapLinkOpen(openInApp = false) {
    const urlInput = document.getElementById('mapChoiceUrl');
    const url = urlInput.value;

    if (!url) {
        console.error('No URL found in map choice modal.');
        closeMapChoiceModal(); // Close modal even if there's an error
        return;
    }

    if (openInApp) {
        // --- Attempt to Open in App ---
        console.log(`Attempting to navigate to app scheme/URL: ${url}`);
        // Use window.location.href to try and trigger app handling by the OS
        // This is less likely to open a new blank tab if the scheme fails.
        window.location.href = url;
        // Note: If the URL is a standard https link, mobile OS might still prompt
        // or open the browser, depending on user settings and OS version.
        // If the URL uses a specific scheme like geo: or maps:, it's more likely
        // to directly target an app or fail gracefully if none is found.

    } else {
        // --- Force Open in Browser Tab ---
        console.log(`Opening map link in new browser tab: ${url}`);
        // window.open with '_blank' is the standard way to open a new tab.
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    // Close the modal after attempting the action
    closeMapChoiceModal();
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    // --- Add/Edit Modal Listeners ---
    const addCustomerBtn = document.getElementById('addCustomerBtn');
    const closeModalBtn = document.getElementById('closeModalBtn'); // For add/edit modal
    const saveCustomerBtn = document.getElementById('saveCustomerBtn');
    const addContactBtn = document.getElementById('addContactBtn');

    if (addCustomerBtn) addCustomerBtn.addEventListener('click', openModalForAdd);
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal); // Close add/edit modal
    if (saveCustomerBtn) saveCustomerBtn.addEventListener('click', handleSaveOrUpdateCustomer);
    if (addContactBtn) {
        addContactBtn.addEventListener('click', () => {
            const contactsContainer = document.getElementById('contactsContainer');
            contactsContainer.appendChild(createContactPairElement('', '', true));
        });
    }

    // --- Manage Action Modal Listeners ---
    const closeManageModalBtn = document.getElementById('closeManageModalBtn');
    const manageEditBtn = document.getElementById('manageEditBtn');
    const manageDeleteBtn = document.getElementById('manageDeleteBtn');
    const manageCancelBtn = document.getElementById('manageCancelBtn');

    if (closeManageModalBtn) closeManageModalBtn.addEventListener('click', closeManageModal);
    if (manageCancelBtn) manageCancelBtn.addEventListener('click', closeManageModal);

    if (manageEditBtn) {
        manageEditBtn.addEventListener('click', () => {
            const customerId = document.getElementById('manageCustomerId').value;
            if (customerId) {
                handleEditCustomer(parseInt(customerId)); // Ensure ID is number
            }
            closeManageModal(); // Close this modal after initiating edit
        });
    }

    if (manageDeleteBtn) {
        manageDeleteBtn.addEventListener('click', () => {
            const customerId = document.getElementById('manageCustomerId').value;
            const customerName = document.getElementById('manageCustomerName').value;
            if (customerId && customerName) {
                // handleDeleteCustomer already includes confirmation
                handleDeleteCustomer(parseInt(customerId), customerName); // Ensure ID is number
            }
            closeManageModal(); // Close this modal after initiating delete
        });
    }

    // --- NEW: Map Choice Modal Listeners ---
    const closeMapChoiceBtn = document.getElementById('closeMapChoiceModalBtn');
    const mapOpenBrowserBtn = document.getElementById('mapOpenBrowserBtn');
    const mapOpenAppBtn = document.getElementById('mapOpenAppBtn');
    const mapCancelBtn = document.getElementById('mapCancelBtn');
    const mapChoiceModal = document.getElementById('mapChoiceModal'); // Get modal element

    if (closeMapChoiceBtn) closeMapChoiceBtn.addEventListener('click', closeMapChoiceModal);
    if (mapCancelBtn) mapCancelBtn.addEventListener('click', closeMapChoiceModal);

    if (mapOpenBrowserBtn) {
        mapOpenBrowserBtn.addEventListener('click', () => handleMapLinkOpen(false));
    }
    if (mapOpenAppBtn) {
        // Pass true, although the underlying action is the same
        mapOpenAppBtn.addEventListener('click', () => handleMapLinkOpen(true));
    }

    // --- Window Click Listeners (for closing modals) ---
    const addEditModal = document.getElementById('customerModal');
    const manageModal = document.getElementById('manageActionModal');
    // Add mapChoiceModal to the list
    window.addEventListener('click', function(event) {
        if (event.target == addEditModal) {
            closeModal();
        } else if (event.target == manageModal) {
            closeManageModal();
        } else if (event.target == mapChoiceModal) { // Check for map choice modal
            closeMapChoiceModal();
        }
    });
}

// --- Initial Load ---
function loadInitialData() {
    // Fetch both customers and trips
    getCustomers(customers => {
        allCustomers = customers;
        getTrips(trips => {
            allTrips = trips;
            // Now display the table with both sets of data
            displayCustomersTable(allCustomers, allTrips);
        });
    });
} 