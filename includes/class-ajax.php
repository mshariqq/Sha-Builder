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

        update_post_meta($post_id, '_sha_builder_data', $data);

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
        if (!is_array($data)) {
            $data = array(
                'html' => '',
                'css'  => '',
                'js'   => '',
            );
        }

        wp_send_json_success($data);
    }

    private function sanitize_html($html) {
        return wp_unslash($html);
    }
}
