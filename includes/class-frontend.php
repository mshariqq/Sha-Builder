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
        add_action('wp_enqueue_scripts', array($this, 'enqueue_globals'));
        add_filter('wp_kses_allowed_html', array($this, 'allow_builder_tags'), 10, 2);

        add_filter('theme_page_templates', array($this, 'add_page_templates'));
        add_filter('template_include', array($this, 'handle_page_template'), 999);

        add_action('add_option_sha_builder_global_css', array($this, 'regenerate_global_files'));
        add_action('update_option_sha_builder_global_css', array($this, 'regenerate_global_files'));
        add_action('add_option_sha_builder_global_js', array($this, 'regenerate_global_files'));
        add_action('update_option_sha_builder_global_js', array($this, 'regenerate_global_files'));
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

    public function sha_get_upload_dir($subdir = 'sha-builder') {
        $upload_dir = wp_upload_dir();
        $dir = trailingslashit($upload_dir['basedir']) . $subdir;
        if (!file_exists($dir)) {
            wp_mkdir_p($dir);
        }
        return trailingslashit($dir);
    }

    public function sha_get_upload_url($subdir = 'sha-builder') {
        $upload_dir = wp_upload_dir();
        return trailingslashit($upload_dir['baseurl']) . $subdir;
    }

    public function regenerate_global_files() {
        $upload_dir = $this->sha_get_upload_dir();

        $css = get_option('sha_builder_global_css', '');
        $js  = get_option('sha_builder_global_js', '');

        if (!empty($css)) {
            $min_css = preg_replace('!/\*[^*]*\*+([^/][^*]*\*+)*/!', '', $css);
            $min_css = preg_replace('/\s+/', ' ', $min_css);
            $min_css = preg_replace('/\s*([{}:;,])\s*/', '$1', $min_css);
            $min_css = trim($min_css);
            $written = (bool) file_put_contents($upload_dir . 'global.css', $min_css);
        } else {
            if (file_exists($upload_dir . 'global.css')) {
                unlink($upload_dir . 'global.css');
            }
            $written = true;
        }

        if (!empty($js)) {
            $min_js = preg_replace('!/\*[^*]*\*+([^/][^*]*\*+)*/!', '', $js);
            $min_js = preg_replace('/^\s*\/\/.*$/m', '', $min_js);
            $min_js = preg_replace('/\s+/', ' ', $min_js);
            $min_js = trim($min_js);
            $js_written = (bool) file_put_contents($upload_dir . 'global.js', $min_js);
        } else {
            if (file_exists($upload_dir . 'global.js')) {
                unlink($upload_dir . 'global.js');
            }
            $js_written = true;
        }

        return $written && $js_written;
    }

    public function enqueue_globals() {
        if (defined('SHA_BUILDER_IS_BUILDER')) {
            return;
        }

        $css = get_option('sha_builder_global_css', '');
        $js  = get_option('sha_builder_global_js', '');

        if (empty($css) && empty($js)) {
            return;
        }

        $upload_dir = $this->sha_get_upload_dir();
        $upload_url = $this->sha_get_upload_url();
        $css_file   = $upload_dir . 'global.css';
        $js_file    = $upload_dir . 'global.js';

        // Auto-regenerate if files missing but options have content
        if (!empty($css) && !file_exists($css_file)) {
            $this->regenerate_global_files();
        }

        if (file_exists($css_file) && !empty($css)) {
            wp_enqueue_style(
                'sha-builder-global',
                $upload_url . 'global.css',
                array(),
                md5_file($css_file)
            );
        } elseif (!empty($css)) {
            wp_register_style('sha-builder-global-inline', false);
            wp_enqueue_style('sha-builder-global-inline');
            wp_add_inline_style('sha-builder-global-inline', $css);
        }

        if (file_exists($js_file) && !empty($js)) {
            wp_enqueue_script(
                'sha-builder-global',
                $upload_url . 'global.js',
                array(),
                md5_file($js_file),
                true
            );
        } elseif (!empty($js)) {
            wp_register_script('sha-builder-global-inline', false, array(), '', true);
            wp_enqueue_script('sha-builder-global-inline');
            wp_add_inline_script('sha-builder-global-inline', $js);
        }
    }

    public function add_page_templates($templates) {
        $templates['template-full-width.php'] = __('Sha Builder - Full Width', 'sha-builder');
        $templates['template-full-blank.php'] = __('Sha Builder - Full Blank', 'sha-builder');
        return $templates;
    }

    public function has_custom_header() {
        $header_id = get_option('sha_builder_active_header', 0);
        if (!$header_id || 'publish' !== get_post_status($header_id)) {
            return false;
        }
        $data = get_post_meta($header_id, '_sha_builder_data', true);
        return is_array($data) && !empty($data['html']);
    }

    public function has_custom_footer() {
        $footer_id = get_option('sha_builder_active_footer', 0);
        if (!$footer_id || 'publish' !== get_post_status($footer_id)) {
            return false;
        }
        $data = get_post_meta($footer_id, '_sha_builder_data', true);
        return is_array($data) && !empty($data['html']);
    }

    public function render_custom_header() {
        if ($this->has_custom_header()) {
            load_template(SHA_BUILDER_PATH . 'public/templates/header.php');
        } else {
            get_header();
        }
    }

    public function render_custom_footer() {
        if ($this->has_custom_footer()) {
            load_template(SHA_BUILDER_PATH . 'public/templates/footer.php');
        } else {
            get_footer();
        }
    }

    public function handle_page_template($template) {
        if (!is_singular() || is_admin() || wp_doing_ajax() || defined('REST_REQUEST')) {
            return $template;
        }

        $post_id = get_the_ID();
        if (!$post_id) {
            return $template;
        }

        $page_template = get_page_template_slug($post_id);

        if ('template-full-blank.php' === $page_template) {
            $file = SHA_BUILDER_PATH . 'public/templates/template-full-blank.php';
            if (file_exists($file)) {
                return $file;
            }
        }

        if ('template-full-width.php' === $page_template) {
            $file = SHA_BUILDER_PATH . 'public/templates/template-full-width.php';
            if (file_exists($file)) {
                return $file;
            }
        }

        if ($this->has_custom_header() || $this->has_custom_footer()) {
            $file = SHA_BUILDER_PATH . 'public/templates/wrapper.php';
            if (file_exists($file)) {
                return $file;
            }
        }

        return $template;
    }
}
