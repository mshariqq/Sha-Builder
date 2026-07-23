<?php
if (!defined('ABSPATH')) {
    exit;
}

class Sha_Builder_Main {

    private static $instance = null;

    private $admin = null;
    private $frontend = null;
    private $ajax_handler = null;
    private $cpt = null;
    private $frontend_builder = null;
    private $shortcodes = null;

    public static function instance() {
        if (is_null(self::$instance)) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        $this->load_dependencies();
        $this->init_hooks();
    }

    private function load_dependencies() {
        require_once SHA_BUILDER_PATH . 'includes/class-file-storage.php';
        require_once SHA_BUILDER_PATH . 'includes/class-admin.php';
        require_once SHA_BUILDER_PATH . 'includes/class-frontend.php';
        require_once SHA_BUILDER_PATH . 'includes/class-ajax.php';
        require_once SHA_BUILDER_PATH . 'includes/class-cpt.php';
        require_once SHA_BUILDER_PATH . 'includes/class-php-executor.php';
        require_once SHA_BUILDER_PATH . 'includes/class-frontend-builder.php';
        require_once SHA_BUILDER_PATH . 'includes/class-shortcodes.php';
    }

    private function init_hooks() {
        // Protect header/footer builder URLs from non‑admin access
        add_action('template_redirect', array($this, 'protect_builder_cpts'));
        // End protection hook
        $this->admin        = new Sha_Builder_Admin();
        $this->frontend     = new Sha_Builder_Frontend();
        $this->ajax_handler = new Sha_Builder_Ajax();
        $this->cpt          = new Sha_Builder_CPT();
        $this->frontend_builder = new Sha_Builder_Frontend_Builder();
        $this->shortcodes = new Sha_Builder_Shortcodes();
    }

    // Redirect non‑admin users away from header/footer builder URLs
    public function protect_builder_cpts() {
        if ( is_singular( array('sha_header','sha_footer','sha_template') ) && ! current_user_can( 'edit_with_sha_builder' ) ) {
            // Option 1: redirect to admin dashboard
            wp_redirect( admin_url() );
            exit;
        }
    }

    public function get_frontend() {
        return $this->frontend;
    }

    public function get_ajax() {
        return $this->ajax_handler;
    }

    public function get_builder_url($post_id) {
        // Front‑end builder URL (used for normal pages).
        // Header/Footer URLs are public for the builder but will be protected by capability checks elsewhere.
        // NOTE: This URL can be accessed by anyone who knows it; to restrict, use the admin‑only version below.
        $post_id = intval($post_id);
        $permalink = get_permalink($post_id);
        if (!$permalink) {
            $permalink = home_url('/?p=' . $post_id);
        }
        return add_query_arg('sha_builder', '1', $permalink);
    }

    /**
     * Generate an admin‑only builder URL for a given post/CPT.
     * Only users with the `edit_with_sha_builder` capability should use this URL.
     */
    public function get_admin_builder_url($post_id) {
        $post_id = intval($post_id);
        // admin_url points to the wp‑admin area; the `post.php` screen loads the editor.
        // Adding `sha_builder=1` tells the plugin to launch the builder UI.
        return add_query_arg('sha_builder', '1', admin_url('post.php?post=' . $post_id . '&action=edit'));
    }

    public static function get_supported_post_types() {
        return apply_filters('sha_builder_supported_post_types', array('page', 'post', 'sha_header', 'sha_footer', 'sha_template'));
    }

    public static function activate() {
        if (!current_user_can('activate_plugins')) {
            return;
        }
        $role = get_role('administrator');
        if ($role) {
            $role->add_cap('edit_with_sha_builder');
        }
        $role = get_role('editor');
        if ($role) {
            $role->add_cap('edit_with_sha_builder');
        }
    }

    public static function deactivate() {
        if (!current_user_can('activate_plugins')) {
            return;
        }
        $role = get_role('administrator');
        if ($role) {
            $role->remove_cap('edit_with_sha_builder');
        }
        $role = get_role('editor');
        if ($role) {
            $role->remove_cap('edit_with_sha_builder');
        }

        $executor = Sha_Builder_PHP_Executor::instance();
        $executor->flush_all_cache();
    }
}
