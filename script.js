document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('file-input');
    const dropZone = document.getElementById('drop-zone');
    const fileNameDisplay = document.getElementById('file-name');
    const resultArea = document.getElementById('result-area');
    const downloadBtn = document.getElementById('download-btn');
    const errorMsg = document.getElementById('error-msg');

    // UI Elements for displaying results
    const resUid = document.getElementById('res-uid');
    const resAuth = document.getElementById('res-auth');
    const resSecret = document.getElementById('res-secret');

    // Decryption Constants
    const KEY_HEX = CryptoJS.enc.Utf8.parse("b5nHjsMrqaeNliSs3jyOzgpD");
    const IV_HEX = CryptoJS.enc.Utf8.parse("wuD6keVr");

    // Drag & Drop Highlighting
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    function highlight(e) {
        dropZone.classList.add('dragover');
    }

    function unhighlight(e) {
        dropZone.classList.remove('dragover');
    }

    // Handle File Selection
    dropZone.addEventListener('drop', handleDrop, false);
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files), false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    function handleFiles(files) {
        if (files.length > 0) {
            const file = files[0];
            fileNameDisplay.textContent = file.name;
            fileNameDisplay.style.display = 'flex'; // Match the CSS flex display
            errorMsg.style.display = 'none';
            resultArea.style.display = 'none';
            downloadBtn.style.display = 'none';

            processFile(file);
        }
    }

    function processFile(file) {
        const reader = new FileReader();

        reader.onload = function (e) {
            try {
                const content = e.target.result; // Expecting text content as typical for this file type if opened as text

                // 1. Sanitize Content
                // The file "54cc..." typically contains a Base64 string.
                // Sometimes it has a binary prefix "F801" or string "ZSv/".

                // Let's treat it as a string first.
                // Look for the start of the standard Base64 header "ZSv/" which corresponds to "Save..." in JSON.
                // Or just try to find the first valid alphanumeric char sequence.

                let base64String = content;

                // Simple heuristic: Find index of "ZSv"
                const marker = "ZSv";
                const idx = content.indexOf(marker);

                if (idx !== -1) {
                    base64String = content.substring(idx);
                } else {
                    // Fallback: Use the whole string, stripping whitespace
                    base64String = content.trim();
                }

                // Clean up potential non-base64 chars at the end
                // (Though usually not needed if we just grab the string)

                // 2. Decode Base64 to Ciphertext WordArray
                const ciphertext = CryptoJS.enc.Base64.parse(base64String);

                // 3. Decrypt using TripleDES
                const decrypted = CryptoJS.TripleDES.decrypt(
                    { ciphertext: ciphertext },
                    KEY_HEX,
                    {
                        iv: IV_HEX,
                        mode: CryptoJS.mode.CBC,
                        padding: CryptoJS.pad.Pkcs7
                    }
                );

                // 4. Convert to Utf8 String
                let decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);

                // 5. Sanitize JSON
                // The decryption might leave some control characters or padding issues if not perfect,
                // or if the python script added specific chars like \b.
                // We'll replace non-printable chars.
                // Keep: Allow generic JSON chars.
                // Simple approach: Find first '{' and last '}'

                const firstBrace = decryptedStr.indexOf('{');
                const lastBrace = decryptedStr.lastIndexOf('}');

                if (firstBrace === -1 || lastBrace === -1) {
                    throw new Error("Invalid decrypted JSON structure.");
                }

                const jsonStr = decryptedStr.substring(firstBrace, lastBrace + 1);

                // 6. Parse JSON
                const data = JSON.parse(jsonStr);

                // 7. Display Results
                if (data.userId && data.authKey && data.secretKey) {
                    resUid.textContent = data.userId;
                    resAuth.textContent = data.authKey;
                    resSecret.textContent = data.secretKey;

                    resultArea.style.display = 'block';

                    // Setup Download
                    const reportContent = `FGO Account Credentials
=======================
User ID: ${data.userId}
Auth Key: ${data.authKey}
Secret Key: ${data.secretKey}

Keep this data safe! Do not share with anyone.
Generated by FGO Key Decryptor.`;

                    downloadBtn.onclick = () => downloadFile('fgo_keys.txt', reportContent);
                    downloadBtn.style.display = 'block';
                } else {
                    throw new Error("Missing expected keys in JSON.");
                }

            } catch (err) {
                console.error(err);
                errorMsg.textContent = "Error: Failed to decrypt. Please ensure this is the correct '54cc...' file.";
                errorMsg.style.display = 'block';
            }
        };

        reader.onerror = function () {
            errorMsg.textContent = "Error reading file.";
            errorMsg.style.display = 'block';
        };

        // Read as Text to easily parse string markers first
        reader.readAsText(file);
    }

    function downloadFile(filename, text) {
        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
        element.setAttribute('download', filename);

        element.style.display = 'none';
        document.body.appendChild(element);

        element.click();

        document.body.removeChild(element);
    }
});

function copyText(elementId) {
    const text = document.getElementById(elementId).textContent;
    const btn = event.currentTarget;
    const originalText = btn.textContent;

    navigator.clipboard.writeText(text).then(() => {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');

        setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}

