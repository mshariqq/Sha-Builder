<?php
if (!defined('ABSPATH')) {
    exit;
}

class Sha_Builder_Frontend {

    public function __construct() {
        add_filter('the_content', array($this, 'render_frontend'), 999);
        add_action('wp_enqueue_scripts', array($this, 'enqueue_styles'));
    }

    public function render_frontend($content) {
        if (!is_singular() || !in_the_loop() || !is_main_query()) {
            return $content;
        }

        $post_id = get_the_ID();
        $saved_data = get_post_meta($post_id, '_sha_builder_data', true);

        if (!is_array($saved_data) || empty($saved_data['html'])) {
            return $content;
        }

        return $this->build_output($saved_data);
    }

    private function build_output($data) {
        $output = '';

        if (!empty($data['css'])) {
            $output .= sprintf(
                '<style id="sha-builder-css-%d">%s</style>',
                get_the_ID(),
                wp_unslash($data['css'])
            );
        }

        $output .= sprintf(
            '<div id="sha-builder-content-%d" class="sha-builder-content-area">%s</div>',
            get_the_ID(),
            wp_unslash($data['html'])
        );

        if (!empty($data['js'])) {
            $output .= sprintf(
                '<script id="sha-builder-js-%d">%s</script>',
                get_the_ID(),
                wp_unslash($data['js'])
            );
        }

        return $output;
    }

    public function enqueue_styles() {
        if (!is_singular()) {
            return;
        }
        $post_id = get_the_ID();
        $saved_data = get_post_meta($post_id, '_sha_builder_data', true);
        if (!is_array($saved_data) || empty($saved_data['html'])) {
            return;
        }

        wp_enqueue_style(
            'sha-builder-frontend',
            SHA_BUILDER_URL . 'public/css/frontend.css',
            array(),
            SHA_BUILDER_VERSION
        );
    }
}
