$(document).ready(function() {
    // Check for saved user preference in local storage
    if (localStorage.getItem('darkMode') === 'enabled') {
        enableDarkMode();
    }

    // Dark mode toggle button event listener
    $('#darkModeSwitch').on('click', function() {
        if (localStorage.getItem('darkMode') !== 'enabled') {
            enableDarkMode();
        } else {
            disableDarkMode();
        }
    });

    // Function to enable dark mode
    function enableDarkMode() {
        $('body').addClass('dark-mode'); // Add dark mode class
        localStorage.setItem('darkMode', 'enabled'); // Save preference
        updateFontColors();
    }

    // Function to disable dark mode
    function disableDarkMode() {
        $('body').removeClass('dark-mode'); // Remove dark mode class
        localStorage.setItem('darkMode', null); // Clear preference
        updateFontColors();
    }

    // Update font colors based on the current theme
    function updateFontColors() {
        if ($('body').hasClass('dark-mode')) {
            $('h1').css('color', '#eaeaea'); // Light heading color
            $('.error').css('color', '#ff4d4d'); // Error color in dark mode
            $('label').css('color', '#eaeaea'); // Light label color
            $('.redirect a').css('color', '#3498db'); // Link color
            $('.footer p').css('color', '#bdc3c7'); // Light footer color
        } else {
            $('h1').css('color', '#3498db'); // Dark heading color
            $('.error').css('color', '#e74c3c'); // Error color in light mode
            $('label').css('color', '#2c3e50'); // Dark label color
            $('.redirect a').css('color', '#3498db'); // Link color
            $('.footer p').css('color', '#2c3e50'); // Dark footer color
        }
    }
});
