<?php
if (!defined('ABSPATH')) {
    exit;
}

class Sha_Builder_Frontend {

    public function __construct() {
        add_filter('the_content', array($this, 'render_frontend_html'), 999);
        add_action('wp_head', array($this, 'render_frontend_css'), 999);
        add_action('wp_footer', array($this, 'render_frontend_js'), 999);
        add_action('wp_enqueue_scripts', array($this, 'enqueue_styles'));
        add_filter('wp_kses_allowed_html', array($this, 'allow_builder_tags'), 10, 2);
    }

    public function has_builder_content($post_id = null) {
        if (!$post_id) {
            $post_id = get_the_ID();
        }
        if (!$post_id) {
            return false;
        }
        $data = get_post_meta($post_id, '_sha_builder_data', true);
        return is_array($data) && !empty($data['html']);
    }

    public function render_frontend_html($content) {
        if (!is_singular() || !in_the_loop() || !is_main_query()) {
            return $content;
        }

        $post_id = get_the_ID();
        if (!$this->has_builder_content($post_id)) {
            return $content;
        }

        $data = get_post_meta($post_id, '_sha_builder_data', true);

        remove_filter('the_content', 'wpautop');
        remove_filter('the_content', 'wptexturize');

        return '<div id="sha-builder-content-' . intval($post_id) . '" class="sha-builder-content-area">'
            . $data['html']
            . '</div>';
    }

    public function render_frontend_css() {
        if (!is_singular()) {
            return;
        }

        $post_id = get_the_ID();
        if (!$this->has_builder_content($post_id)) {
            return;
        }

        $data = get_post_meta($post_id, '_sha_builder_data', true);
        if (!empty($data['css'])) {
            $css = preg_replace('/^html(?::[^\s>]*)?\s*>\s*body(?::[^\s>]*)?\s*>\s*/im', '', $data['css']);
            echo "\n<style id=\"sha-builder-css-" . intval($post_id) . "\">\n"
                . $css . "\n</style>\n";
        }
    }

    public function render_frontend_js() {
        if (!is_singular()) {
            return;
        }

        $post_id = get_the_ID();
        if (!$this->has_builder_content($post_id)) {
            return;
        }

        $data = get_post_meta($post_id, '_sha_builder_data', true);
        if (!empty($data['js'])) {
            echo "\n<script id=\"sha-builder-js-" . intval($post_id) . "\">\n"
                . $data['js'] . "\n</script>\n";
        }
    }

    public function enqueue_styles() {
        if (!is_singular()) {
            return;
        }
        $post_id = get_the_ID();
        if (!$this->has_builder_content($post_id)) {
            return;
        }

        wp_enqueue_style(
            'sha-builder-frontend',
            SHA_BUILDER_URL . 'public/css/frontend.css',
            array(),
            SHA_BUILDER_VERSION
        );
    }

    public function allow_builder_tags($allowed, $context) {
        if ('post' !== $context) {
            return $allowed;
        }
        $allowed['style'] = array(
            'type'  => true,
            'media' => true,
            'id'    => true,
            'nonce' => true,
        );
        $allowed['link'] = array(
            'rel'  => true,
            'href' => true,
            'type' => true,
            'id'   => true,
            'class' => true,
            'media' => true,
        );
        $allowed['script'] = array(
            'type' => true,
            'src'  => true,
            'id'   => true,
            'async' => true,
            'defer' => true,
            'class' => true,
        );
        return $allowed;
    }
}
