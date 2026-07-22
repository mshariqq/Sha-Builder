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

    /**
     * Load and migrate builder data to section format.
     */
    public function get_data($post_id) {
        $raw = get_post_meta($post_id, '_sha_builder_data', true);
        if (!is_array($raw)) {
            return null;
        }
        $ajax = sha_builder()->get_ajax();
        if ($ajax) {
            return $ajax->migrate_to_sections($raw, $post_id);
        }
        return $raw;
    }

    public function has_builder_content($post_id = null) {
        if (!$post_id) {
            $post_id = get_the_ID();
        }
        if (!$post_id) {
            return false;
        }
        $data = $this->get_data($post_id);
        return is_array($data)
            && isset($data['sections'])
            && is_array($data['sections'])
            && !empty($data['sections']);
    }

    public function render_frontend_html($content) {
        if (!is_singular() || !in_the_loop() || !is_main_query()) {
            return $content;
        }

        $post_id = get_the_ID();
        $data = $this->get_data($post_id);
        if (!$data || empty($data['sections'])) {
            return $content;
        }

        remove_filter('the_content', 'wpautop');
        remove_filter('the_content', 'wptexturize');

        $executor = Sha_Builder_PHP_Executor::instance();
        $out = '';

        foreach ($data['sections'] as $sec) {
            if (!is_array($sec) || empty($sec['html'])) {
                continue;
            }
            $sec_id = isset($sec['id']) ? esc_attr($sec['id']) : '';
            $html_file = isset($sec['_html_file']) ? $sec['_html_file'] : null;
            $sec_html = $executor->execute_html($post_id, $sec_id, $sec['html'], $html_file);
            $section_attrs = apply_filters('sha_builder_section_attributes', array(
                'id' => 'sha-section-' . $sec_id,
                'class' => 'sha-builder-section',
            ), $sec_id);
            $attr_str = '';
            foreach ($section_attrs as $key => $val) {
                $attr_str .= ' ' . $key . '="' . esc_attr($val) . '"';
            }
            $out .= '<div' . $attr_str . '>'
                . $sec_html
                . '</div>' . "\n";
        }

        return '<div id="sha-builder-content-' . intval($post_id) . '" class="sha-builder-content-area">'
            . $out
            . '</div>';
    }

    public function render_frontend_css() {
        if (!is_singular()) {
            return;
        }

        $post_id = get_the_ID();
        $data = $this->get_data($post_id);
        if (!$data || empty($data['sections'])) {
            return;
        }

        $css_parts = array();

        // Per-section CSS
        foreach ($data['sections'] as $sec) {
            if (!empty($sec['css'])) {
                $cleaned = preg_replace('/^html(?::[^\s>]*)?\s*>\s*body(?::[^\s>]*)?\s*>\s*/im', '', $sec['css']);
                $css_parts[] = $cleaned;
            }
        }

        // Global CSS
        if (!empty($data['global_css'])) {
            $cleaned = preg_replace('/^html(?::[^\s>]*)?\s*>\s*body(?::[^\s>]*)?\s*>\s*/im', '', $data['global_css']);
            $css_parts[] = $cleaned;
        }

        if (!empty($css_parts)) {
            $combined = implode("\n", $css_parts);
            echo "\n<style id=\"sha-builder-css-" . intval($post_id) . "\">\n"
                . wp_strip_all_tags($combined) . "\n</style>\n";
        }

        /* element overrides */
        if (!empty($data['element_overrides'])) {
            $overrides_css = array();
            foreach ($data['element_overrides'] as $section_id => $selectors) {
                if (!is_array($selectors)) continue;
                foreach ($selectors as $selector => $props) {
                    if (!is_array($props)) continue;
                    $declarations = array();
                    foreach ($props as $prop => $val) {
                        $declarations[] = $prop . ':' . $val;
                    }
                    if (!empty($declarations)) {
                        $overrides_css[] = $selector . ' { ' . implode(';', $declarations) . ' }';
                    }
                }
            }
            if (!empty($overrides_css)) {
                echo "\n<style id=\"sha-builder-overrides-" . intval($post_id) . "\">\n"
                    . implode("\n", $overrides_css) . "\n</style>\n";
            }
        }
    }

    public function render_frontend_js() {
        if (!is_singular()) {
            return;
        }

        $post_id = get_the_ID();
        $data = $this->get_data($post_id);
        if (!$data || empty($data['sections'])) {
            return;
        }

        $js_parts = array();

        // Per-section JS
        foreach ($data['sections'] as $sec) {
            if (!empty($sec['js'])) {
                $js_parts[] = $sec['js'];
            }
        }

        // Global JS
        if (!empty($data['global_js'])) {
            $js_parts[] = $data['global_js'];
        }

        if (!empty($js_parts)) {
            $combined = implode("\n", $js_parts);
            echo "\n<script id=\"sha-builder-js-" . intval($post_id) . "\">\n"
                . "\n// <![CDATA[\n" . $combined . "\n// ]]>\n<\/script>\n";
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
        return trailingslashit(trailingslashit($upload_dir['baseurl']) . $subdir);
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

    public function get_effective_header_id() {
        $post_id = get_the_ID();
        if ($post_id) {
            $page_header_id = get_post_meta($post_id, '_sha_builder_page_header', true);
            if ($page_header_id && 'publish' === get_post_status($page_header_id)) {
                return intval($page_header_id);
            }
        }
        return intval(get_option('sha_builder_active_header', 0));
    }

    public function get_effective_footer_id() {
        $post_id = get_the_ID();
        if ($post_id) {
            $page_footer_id = get_post_meta($post_id, '_sha_builder_page_footer', true);
            if ($page_footer_id && 'publish' === get_post_status($page_footer_id)) {
                return intval($page_footer_id);
            }
        }
        return intval(get_option('sha_builder_active_footer', 0));
    }

    public function has_custom_header() {
        $header_id = $this->get_effective_header_id();
        if (!$header_id || 'publish' !== get_post_status($header_id)) {
            return false;
        }
        $data = $this->get_data($header_id);
        return is_array($data) && !empty($data['sections']);
    }

    public function has_custom_footer() {
        $footer_id = $this->get_effective_footer_id();
        if (!$footer_id || 'publish' !== get_post_status($footer_id)) {
            return false;
        }
        $data = $this->get_data($footer_id);
        return is_array($data) && !empty($data['sections']);
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

        // If this is a Header or Footer CPT, use a minimal full‑canvas template.
        $post_type = get_post_type($post_id);
        if ( in_array( $post_type, array('sha_header','sha_footer'), true ) ) {
            $file = SHA_BUILDER_PATH . 'public/templates/template-full-canvas.php';
            if ( file_exists( $file ) ) {
                return $file;
            }
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
