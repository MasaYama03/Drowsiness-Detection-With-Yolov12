/**
 * Contact Support Module
 * Handles the contact support form with subject selection and message
 */

class ContactSupport {
    constructor() {
        this.modal = null;
        this.init();
    }

    async init() {
        this.createModal();
        this.setupEventListeners();
    }

    createModal() {
        this.modal = document.createElement('div');
        this.modal.className = 'modal-overlay hidden';
        this.modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        `;
        
        this.modal.innerHTML = `
            <div class="support-modal" style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border-radius: 12px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                padding: 30px;
                max-width: 500px;
                width: 90%;
                max-height: 90vh;
                overflow-y: auto;
                text-align: center;
                z-index: 1001;
            ">
                <button id="close-support-modal" 
                        style="
                            position: absolute;
                            top: 15px;
                            right: 15px;
                            background: none;
                            border: none;
                            color: #9ca3af;
                            width: 32px;
                            height: 32px;
                            border-radius: 50%;
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            transition: all 0.3s ease;
                            font-size: 18px;
                        "
                        onmouseover="this.style.background='#f3f4f6'; this.style.color='#374151';"
                        onmouseout="this.style.background='none'; this.style.color='#9ca3af';">
                    <i class="fas fa-times"></i>
                </button>
                
                <div class="text-center mb-8">
                    <div class="text-4xl text-indigo-600 mb-4" style="transition: all 0.3s ease;"
                         onmouseover="this.style.transform='scale(1.1)';"
                         onmouseout="this.style.transform='scale(1)';">
                        <i class="fas fa-headset"></i>
                    </div>
                    <h2 class="text-3xl font-bold text-gray-800 mb-2">Contact Support</h2>
                    <p class="text-gray-600">We're here to help you</p>
                </div>
                
                <form id="contact-support-form" class="space-y-6">
                    <div>
                        <label class="block text-sm text-gray-600 mb-1">Subject <span class="text-red-500">*</span></label>
                        <div class="relative">
                            <select id="support-subject" required
                                    class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none bg-white text-gray-800">
                                <option value="" disabled selected>Select a subject</option>
                                <option value="Technical Issue">Technical Issue</option>
                                <option value="Feature Request">Feature Request</option>
                                <option value="Bug Report">Bug Report</option>
                                <option value="Account Help">Account Help</option>
                                <option value="Other">Other</option>
                            </select>
                            <i class="fas fa-chevron-down absolute right-4 top-4 text-gray-400 pointer-events-none"></i>
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm text-gray-600 mb-1">Message <span class="text-red-500">*</span></label>
                        <div class="relative">
                            <textarea id="support-message" rows="4" required
                                    class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-800"
                                    placeholder="Please describe your issue in detail..."></textarea>
                            <p class="text-xs text-gray-500 mt-1">Minimum 10 characters required</p>
                        </div>
                    </div>
                    
                    <div class="flex space-x-4 pt-2">
                        <button type="button" id="cancel-support"
                                class="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg hover:bg-gray-300 transition duration-300 font-medium">
                            Cancel
                        </button>
                        <button type="submit" id="support-submit-btn"
                                class="flex-1 bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition duration-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled>
                            <i class="fas fa-paper-plane mr-2"></i>Send Message
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(this.modal);
    }

    setupEventListeners() {
        const subjectInput = this.modal.querySelector('#support-subject');
        const messageInput = this.modal.querySelector('#support-message');
        const submitBtn = this.modal.querySelector('#support-submit-btn');
        const closeBtn = this.modal.querySelector('#close-support-modal');
        const cancelBtn = this.modal.querySelector('#cancel-support');

        // Form validation
        const validateForm = () => {
            const isFormValid = 
                subjectInput.value.trim() && 
                messageInput.value.trim().length >= 10;
            
            submitBtn.disabled = !isFormValid;
        };

        // Input event listeners
        subjectInput.addEventListener('change', validateForm);
        messageInput.addEventListener('input', validateForm);

        // Close modal when clicking the close button (X)
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.closeModal();
        });

        // Close when clicking cancel button
        cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.closeModal();
        });

        // Close when clicking outside the modal
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });

        // Handle form submission
        const form = this.modal.querySelector('#contact-support-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit(e);
        });
    }

    showModal() {
        this.modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        this.modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    async handleSubmit(e) {
        console.log('[ContactSupport] Form submission started');
        e.preventDefault();
        
        try {
            // Get form elements
            const subjectEl = document.getElementById('support-subject');
            const messageEl = document.getElementById('support-message');
            const submitBtn = document.getElementById('support-submit-btn');
            
            if (!subjectEl || !messageEl || !submitBtn) {
                console.error('[ContactSupport] Form elements not found');
                showToast('Terjadi kesalahan pada form. Silakan refresh halaman.', 'error');
                return;
            }
            
            // Get form values
            const subject = subjectEl.value.trim();
            const message = messageEl.value.trim();
            
            console.log('[ContactSupport] Form values:', { subject, message });
            
            // Validate form
            if (!subject) {
                console.log('[ContactSupport] No subject selected');
                showToast('Silakan pilih subjek', 'error');
                return;
            }
            
            if (message.length < 10) {
                console.log('[ContactSupport] Message too short');
                showToast('Pesan harus minimal 10 karakter', 'error');
                return;
            }
            
            // Get API base URL
            const API_BASE_URL = window.API_BASE_URL || 'http://localhost:5000';
            const endpoint = `${API_BASE_URL}/api/contact/support`;
            
            // Update UI for submission
            submitBtn.disabled = true;
            const originalBtnText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Mengirim...';
            
            console.log('[ContactSupport] Sending request to:', endpoint);
            
            // Prepare request
            const requestData = {
                subject: subject,
                message: message,
                timestamp: new Date().toISOString()
            };
            
            const headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };
            
            // Add auth token if available
            const authToken = localStorage.getItem('authToken');
            if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
                console.log('[ContactSupport] Added auth token to request');
            }
            
            // Make the request
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestData)
            });
            
            console.log('[ContactSupport] Response status:', response.status);
            
            if (!response.ok) {
                let errorMessage = `Gagal mengirim pesan (${response.status}).`;
                try {
                    const errorData = await response.json();
                    console.error('[ContactSupport] Error response:', errorData);
                    errorMessage = errorData.message || errorMessage;
                } catch (e) {
                    console.error('[ContactSupport] Failed to parse error response:', e);
                }
                throw new Error(errorMessage);
            }
            
            // Handle success
            const responseData = await response.json();
            console.log('[ContactSupport] Success:', responseData);
            
            // Reset form
            subjectEl.value = '';
            messageEl.value = '';
            
            // Show success message
            showToast('Pesan Anda telah terkirim. Kami akan segera menghubungi Anda!', 'success');
            
            // Close modal after a short delay
            setTimeout(() => {
                this.closeModal();
            }, 1500);
            
        } catch (error) {
            console.error('[ContactSupport] Submission error:', error);
            const errorMessage = error.message || 'Terjadi kesalahan saat mengirim pesan. Silakan coba lagi.';
            showToast(errorMessage, 'error');
        } finally {
            // Reset button state
            const submitBtn = document.getElementById('support-submit-btn');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Kirim Pesan';
            }
            console.log('[ContactSupport] Form submission finished');
        }
    }
}

// Contact support instance
let contactSupportInstance = null;

// Function to initialize contact support when needed
function initContactSupport() {
    if (!contactSupportInstance) {
        contactSupportInstance = new ContactSupport();
    }
    return contactSupportInstance;
}

// Function to show the contact support modal
function showContactSupportModal() {
    const support = initContactSupport();
    if (support && typeof support.showModal === 'function') {
        support.showModal();
    } else {
        console.error('Failed to initialize contact support');
        // Fallback to a simple alert
        alert('Please contact us at: support@example.com');
    }
}

// Export the show function
window.showContactSupportModal = showContactSupportModal;
