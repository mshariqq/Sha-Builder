<?php
if (!defined('ABSPATH')) {
    exit;
}

class Sha_Builder_Main {

    private static $instance = null;

    private $admin = null;
    private $frontend = null;
    private $ajax_handler = null;

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
        require_once SHA_BUILDER_PATH . 'includes/class-admin.php';
        require_once SHA_BUILDER_PATH . 'includes/class-frontend.php';
        require_once SHA_BUILDER_PATH . 'includes/class-ajax.php';
    }

    private function init_hooks() {
        $this->admin        = new Sha_Builder_Admin();
        $this->frontend     = new Sha_Builder_Frontend();
        $this->ajax_handler = new Sha_Builder_Ajax();

        add_action('init', array($this, 'add_rewrite_rules'));
        add_filter('query_vars', array($this, 'add_builder_query_var'));
        add_action('template_redirect', array($this, 'handle_builder_request'));
    }

    public function add_rewrite_rules() {
        add_rewrite_rule(
            'sha-builder/([0-9]+)/?$',
            'index.php?sha_builder_id=$matches[1]',
            'top'
        );
    }

    public function add_builder_query_var($vars) {
        $vars[] = 'sha_builder_id';
        return $vars;
    }

    public function get_builder_url($post_id) {
        $permalink = get_option('permalink_structure');
        if (!empty($permalink)) {
            return home_url('/sha-builder/' . intval($post_id) . '/');
        }
        return home_url('/?sha_builder_id=' . intval($post_id));
    }

    public function handle_builder_request() {
        $post_id = get_query_var('sha_builder_id');
        if (!$post_id) {
            return;
        }

        $post = get_post($post_id);
        if (!$post || !in_array($post->post_type, array('page', 'post'), true)) {
            wp_die(__('Invalid page.', 'sha-builder'));
        }
        if (!current_user_can('edit_post', $post_id)) {
            wp_die(__('Permission denied.', 'sha-builder'));
        }

        $saved_data = get_post_meta($post_id, '_sha_builder_data', true);
        if (!is_array($saved_data)) {
            $saved_data = array(
                'html' => '<div style="padding:60px 40px;text-align:center;font-family:Arial,sans-serif;color:#333;"><h1 style="margin:0 0 12px;font-size:28px;">Start Building</h1><p style="font-size:16px;color:#666;">Add your HTML code in the editor panel and click Render.</p></div>',
                'css'  => '',
                'js'   => '',
            );
        }

        wp_enqueue_style(
            'sha-builder-builder',
            SHA_BUILDER_URL . 'admin/css/builder.css',
            array(),
            SHA_BUILDER_VERSION
        );

        wp_enqueue_script(
            'sha-builder-builder',
            SHA_BUILDER_URL . 'admin/js/builder.js',
            array('jquery'),
            SHA_BUILDER_VERSION,
            true
        );

        wp_localize_script('sha-builder-builder', 'shaBuilder', array(
            'ajaxUrl'  => admin_url('admin-ajax.php'),
            'nonce'    => wp_create_nonce('sha_builder_nonce'),
            'postId'   => $post_id,
            'closeUrl' => admin_url('edit.php?post_type=' . urlencode(get_post_type($post_id))),
            'strings'  => array(
                'saveSuccess' => __('Page saved successfully!', 'sha-builder'),
                'saveError'   => __('Error saving page. Please try again.', 'sha-builder'),
                'saving'      => __('Saving...', 'sha-builder'),
                'save'        => __('Save', 'sha-builder'),
                'render'      => __('Render', 'sha-builder'),
                'unsaved'     => __('You have unsaved changes. Are you sure you want to leave?', 'sha-builder'),
            ),
        ));

        status_header(200);
        include SHA_BUILDER_PATH . 'admin/templates/builder-page.php';
        exit;
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
        Sha_Builder_Main::add_rewrite_rules_static();
        flush_rewrite_rules();
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
        flush_rewrite_rules();
    }

    private static function add_rewrite_rules_static() {
        add_rewrite_rule(
            'sha-builder/([0-9]+)/?$',
            'index.php?sha_builder_id=$matches[1]',
            'top'
        );
    }
}
