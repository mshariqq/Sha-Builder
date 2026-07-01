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
        require_once SHA_BUILDER_PATH . 'includes/class-cpt.php';
    }

    private function init_hooks() {
        $this->admin        = new Sha_Builder_Admin();
        $this->frontend     = new Sha_Builder_Frontend();
        $this->ajax_handler = new Sha_Builder_Ajax();
        $this->cpt          = new Sha_Builder_CPT();

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

    public function get_frontend() {
        return $this->frontend;
    }

    public function get_builder_url($post_id) {
        $post_id = intval($post_id);
        $permalink = get_option('permalink_structure');
        if (!empty($permalink)) {
            $url = home_url('/sha-builder/' . $post_id . '/');
        } else {
            $url = home_url('/?sha_builder_id=' . $post_id);
        }
        $url = add_query_arg('_wpnonce', wp_create_nonce('sha_builder_access_' . $post_id), $url);
        return $url;
    }

    public static function get_supported_post_types() {
        return apply_filters('sha_builder_supported_post_types', array('page', 'post', 'sha_header', 'sha_footer'));
    }

    public function handle_builder_request() {
        $post_id = get_query_var('sha_builder_id');
        if (!$post_id) {
            return;
        }

        $post_id = intval($post_id);

        if (!is_user_logged_in()) {
            wp_die(__('You must be logged in to access the builder.', 'sha-builder'), 401);
        }

        if (!isset($_GET['_wpnonce']) || !wp_verify_nonce($_GET['_wpnonce'], 'sha_builder_access_' . $post_id)) {
            wp_die(__('Security check failed. Please try again.', 'sha-builder'), 403);
        }

        $post = get_post($post_id);
        if (!$post || !in_array($post->post_type, self::get_supported_post_types(), true)) {
            wp_die(__('Invalid page.', 'sha-builder'), 404);
        }

        if (!current_user_can('edit_post', $post_id)) {
            wp_die(__('Permission denied.', 'sha-builder'), 403);
        }

        if (!defined('SHA_BUILDER_IS_BUILDER')) {
            define('SHA_BUILDER_IS_BUILDER', true);
        }

        $this->send_security_headers();

        $saved_data = get_post_meta($post_id, '_sha_builder_data', true);
        error_log('[SHA BUILDER] Builder page load post_id=' . $post_id . ' data_type=' . gettype($saved_data) . ' is_array=' . (is_array($saved_data) ? 'true' : 'false'));
        if (!empty($saved_data['html'])) { error_log('[SHA BUILDER] Loaded html starts with: ' . substr($saved_data['html'], 0, 100)); }
        if (!is_array($saved_data)) {
            $saved_data = array(
                'html' => '<div style="padding:60px 40px;text-align:center;font-family:Arial,sans-serif;color:#333;"><h1 style="margin:0 0 12px;font-size:28px;">Start Building</h1><p style="font-size:16px;color:#666;">Add your HTML code in the editor panel and click Render.</p></div>',
                'css'  => '',
                'js'   => '',
            );
        } else {
            if (!empty($saved_data['css'])) {
                $saved_data['css'] = preg_replace('/^html(?::[^\s>]*)?\s*>\s*body(?::[^\s>]*)?\s*>\s*/im', '', $saved_data['css']);
            }
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
            'ajaxUrl'     => admin_url('admin-ajax.php'),
            'nonce'       => wp_create_nonce('sha_builder_nonce'),
            'postId'      => $post_id,
            'closeUrl'    => wp_nonce_url(admin_url('edit.php?post_type=' . urlencode(get_post_type($post_id))), 'sha_builder_close'),
            'closeNonce'  => wp_create_nonce('sha_builder_close'),
            'globalCss'   => get_option('sha_builder_global_css', ''),
            'globalJs'    => get_option('sha_builder_global_js', ''),
            'strings'     => array(
                'saveSuccess' => __('Page saved successfully!', 'sha-builder'),
                'saveError'   => __('Error saving page. Please try again.', 'sha-builder'),
                'saving'      => __('Saving...', 'sha-builder'),
                'save'        => __('Save', 'sha-builder'),
                'render'      => __('Render', 'sha-builder'),
                'unsaved'     => __('You have unsaved changes. Are you sure you want to leave?', 'sha-builder'),
            ),
        ));

        show_admin_bar(false);
        status_header(200);
        include SHA_BUILDER_PATH . 'admin/templates/builder-page.php';
        exit;
    }

    private function send_security_headers() {
        header('X-Frame-Options: SAMEORIGIN');
        header('X-Content-Type-Options: nosniff');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        header("Content-Security-Policy: frame-ancestors 'self';");
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
