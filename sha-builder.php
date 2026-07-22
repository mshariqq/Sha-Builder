<?php
/**
 * Plugin Name:       Sha Builder
 * Plugin URI:        https://github.com/mshariqq/Sha-Builder
 * Description:       A powerful visual page builder for WordPress — edit HTML, CSS, and JS visually with live preview. Select elements, edit properties, and save like Elementor.
 * Version:           2.0.4
 * Author:            Muhammed Shariq
 * Author URI:        https://mshariqq.github.io
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       sha-builder
 * Domain Path:       /languages
 */

if (!defined('ABSPATH')) {
    exit;
}

define('SHA_BUILDER_VERSION', '2.0.4');
define('SHA_BUILDER_FILE', __FILE__);
define('SHA_BUILDER_PATH', plugin_dir_path(__FILE__));
define('SHA_BUILDER_URL', plugin_dir_url(__FILE__));
define('SHA_BUILDER_BASENAME', plugin_basename(__FILE__));

// Start output buffering early for our AJAX endpoints to capture PHP warnings
// (e.g. post_max_size exceeded) before they pollute JSON responses
if (defined('DOING_AJAX') && DOING_AJAX
    && isset($_REQUEST['action'])
    && strpos($_REQUEST['action'], 'sha_builder_') === 0
) {
    ob_start();
}

require_once SHA_BUILDER_PATH . 'includes/class-main.php';

register_activation_hook(__FILE__, array('Sha_Builder_Main', 'activate'));
register_deactivation_hook(__FILE__, array('Sha_Builder_Main', 'deactivate'));

function sha_builder() {
    return Sha_Builder_Main::instance();
}
sha_builder();
