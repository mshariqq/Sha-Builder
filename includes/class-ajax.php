<?php
if (!defined('ABSPATH')) {
    exit;
}

class Sha_Builder_Ajax {

    public function __construct() {
        add_action('wp_ajax_sha_builder_save', array($this, 'save_builder_data'));
        add_action('wp_ajax_sha_builder_load', array($this, 'load_builder_data'));
    }

    public function save_builder_data() {
        check_ajax_referer('sha_builder_nonce', 'nonce');

        $post_id = isset($_POST['post_id']) ? intval($_POST['post_id']) : 0;
        if (!$post_id || !current_user_can('edit_post', $post_id)) {
            wp_send_json_error(array('message' => __('Permission denied.', 'sha-builder')));
        }

        $post = get_post($post_id);
        if (!$post) {
            wp_send_json_error(array('message' => __('Post not found.', 'sha-builder')));
        }

        $html = isset($_POST['html']) ? $this->sanitize_html($_POST['html']) : '';
        $css  = isset($_POST['css'])  ? wp_unslash($_POST['css']) : '';
        $js   = isset($_POST['js'])   ? wp_unslash($_POST['js']) : '';

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
        check_ajax_referer('sha_builder_nonce', 'nonce');

        $post_id = isset($_POST['post_id']) ? intval($_POST['post_id']) : 0;
        if (!$post_id || !current_user_can('edit_post', $post_id)) {
            wp_send_json_error(array('message' => __('Permission denied.', 'sha-builder')));
        }

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

    private function sanitize_html($html) {
        return wp_unslash($html);
    }
}
