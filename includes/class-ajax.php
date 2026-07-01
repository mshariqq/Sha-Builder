<?php
if (!defined('ABSPATH')) {
    exit;
}

class Sha_Builder_Ajax {

    private const MAX_HTML_LENGTH = 524288;
    private const MAX_CSS_LENGTH  = 262144;
    private const MAX_JS_LENGTH   = 262144;

    public function __construct() {
        add_action('wp_ajax_sha_builder_save', array($this, 'save_builder_data'));
        add_action('wp_ajax_sha_builder_load', array($this, 'load_builder_data'));
    }

    private function verify_request() {
        if (!is_user_logged_in()) {
            wp_send_json_error(array('message' => __('Authentication required.', 'sha-builder')));
        }
        check_ajax_referer('sha_builder_nonce', 'nonce');
    }

    private function validate_post($post_id) {
        $post = get_post($post_id);
        if (!$post) {
            wp_send_json_error(array('message' => __('Post not found.', 'sha-builder')));
        }
        if (!in_array($post->post_type, Sha_Builder_Main::get_supported_post_types(), true)) {
            wp_send_json_error(array('message' => __('Invalid post type.', 'sha-builder')));
        }
        if (!current_user_can('edit_post', $post_id)) {
            wp_send_json_error(array('message' => __('Permission denied.', 'sha-builder')));
        }
        return $post;
    }

    public function save_builder_data() {
        $this->verify_request();

        $post_id = isset($_POST['post_id']) ? intval($_POST['post_id']) : 0;
        if (!$post_id) {
            wp_send_json_error(array('message' => __('Invalid post ID.', 'sha-builder')));
        }

        $this->validate_post($post_id);

        $html = isset($_POST['html']) ? $this->sanitize_code_input($_POST['html'], self::MAX_HTML_LENGTH) : '';
        $css  = isset($_POST['css'])  ? $this->sanitize_code_input($_POST['css'], self::MAX_CSS_LENGTH) : '';
        $js   = isset($_POST['js'])   ? $this->sanitize_code_input($_POST['js'], self::MAX_JS_LENGTH) : '';

        $data = array(
            'html'     => $html,
            'css'      => $css,
            'js'       => $js,
            'saved_at' => current_time('mysql'),
        );

        error_log('[SHA BUILDER] Saving post_id=' . $post_id . ' html_len=' . strlen($html) . ' css_len=' . strlen($css) . ' js_len=' . strlen($js));

        $result = update_post_meta($post_id, '_sha_builder_data', $data);

        if (false === $result) {
            $existing = get_post_meta($post_id, '_sha_builder_data', true);
            error_log('[SHA BUILDER] update_post_meta returned false. Existing data type: ' . gettype($existing) . ' serialized: ' . maybe_serialize($existing));
        }

        wp_send_json_success(array(
            'message' => __('Page saved successfully.', 'sha-builder'),
        ));
    }

    public function load_builder_data() {
        $this->verify_request();

        $post_id = isset($_POST['post_id']) ? intval($_POST['post_id']) : 0;
        if (!$post_id) {
            wp_send_json_error(array('message' => __('Invalid post ID.', 'sha-builder')));
        }

        $this->validate_post($post_id);

        $data = get_post_meta($post_id, '_sha_builder_data', true);
        error_log('[SHA BUILDER] Load post_id=' . $post_id . ' data_type=' . gettype($data) . ' is_array=' . (is_array($data) ? 'true' : 'false'));

        if (!is_array($data)) {
            $data = array(
                'html' => '',
                'css'  => '',
                'js'   => '',
            );
        } elseif (!empty($data['css'])) {
            $data['css'] = preg_replace('/^html(?::[^\s>]*)?\s*>\s*body(?::[^\s>]*)?\s*>\s*/im', '', $data['css']);
        }

        wp_send_json_success($data);
    }

    private function sanitize_code_input($input, $max_length) {
        $input = wp_unslash($input);
        $input = wp_check_invalid_utf8($input, true);
        if (strlen($input) > $max_length) {
            $input = substr($input, 0, $max_length);
        }
        return $input;
    }
}
