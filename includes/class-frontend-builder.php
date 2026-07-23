<?php
if (!defined('ABSPATH')) {
    exit;
}

class Sha_Builder_Frontend_Builder {

    private static $builder_mode = false;
    private static $section_data = null;
    private static $ajax_handler = null;

    public function __construct() {
        add_action('wp', array($this, 'check_builder_mode'));
        add_action('admin_bar_menu', array($this, 'add_admin_bar_button'), 999);
        add_action('wp_enqueue_scripts', array($this, 'enqueue_assets'));
        add_action('wp_footer', array($this, 'render_sections_json'), 1);

        add_filter('sha_builder_section_attributes', array($this, 'add_builder_attributes'), 10, 2);
        add_action('wp_ajax_sha_builder_frontend_save', array($this, 'ajax_save_section'));
        add_action('wp_ajax_sha_builder_frontend_get_section', array($this, 'ajax_get_section'));
    }

    public static function is_builder_mode() {
        return self::$builder_mode;
    }

    public function check_builder_mode() {
        if (is_admin() || !is_user_logged_in()) {
            return;
        }
        if (isset($_GET['sha_builder']) && $_GET['sha_builder'] === '1') {
            $post_id = get_the_ID();
            if ($post_id && current_user_can('edit_post', $post_id)) {
                self::$builder_mode = true;
            }
        }
    }

    public function add_admin_bar_button($wp_admin_bar) {
        if (is_admin() || !is_user_logged_in() || !current_user_can('edit_posts')) {
            return;
        }
        if (!is_singular()) {
            return;
        }

        $post_id = get_the_ID();
        $frontend = sha_builder()->get_frontend();

        // Check if post uses a template — show "Edit Template" button
        if (!$frontend->has_builder_content($post_id)) {
            $post_type = get_post_type($post_id);
            if (strpos($post_type, 'sha_') !== 0) {
                $template_id = $frontend->get_active_template_for_post_type($post_type);
                if ($template_id && $frontend->has_builder_content($template_id)) {
                    $template_builder_url = Sha_Builder_Main::instance()->get_builder_url($template_id);
                    $wp_admin_bar->add_node(array(
                        'id'    => 'sha-builder',
                        'title' => '<span style="display:flex;align-items:center;gap:6px;">'
                            . '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f0833a" stroke-width="2.5"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="22" x2="12" y2="15.5"/><polyline points="22 8.5 12 15.5 2 8.5"/></svg>'
                            . '<span style="color:#f0833a;font-weight:600;">' . esc_html__('Edit Template', 'sha-builder') . '</span></span>',
                        'href'  => $template_builder_url,
                        'meta'  => array('class' => 'sha-builder-admin-btn'),
                    ));
                }
            }
            return;
        }

        if (self::$builder_mode) {
            $current_url = remove_query_arg('sha_builder');
            $wp_admin_bar->add_node(array(
                'id'    => 'sha-builder',
                'title' => '<span style="display:flex;align-items:center;gap:6px;">'
                    . '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f0833a" stroke-width="2.5"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="22" x2="12" y2="15.5"/><polyline points="22 8.5 12 15.5 2 8.5"/></svg>'
                    . '<span style="color:#f0833a;font-weight:600;">Exit Builder</span></span>',
                'href'  => $current_url,
                'meta'  => array('class' => 'sha-builder-admin-btn'),
            ));
        } else {
            $builder_url = add_query_arg('sha_builder', '1');
            $wp_admin_bar->add_node(array(
                'id'    => 'sha-builder',
                'title' => '<span style="display:flex;align-items:center;gap:6px;">'
                    . '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="22" x2="12" y2="15.5"/><polyline points="22 8.5 12 15.5 2 8.5"/></svg>'
                    . ' Edit with Sha Builder</span>',
                'href'  => $builder_url,
                'meta'  => array('class' => 'sha-builder-admin-btn'),
            ));
        }
    }

    public function enqueue_assets() {
        if (!self::$builder_mode) {
            return;
        }

        wp_enqueue_style(
            'sha-builder-frontend-builder',
            SHA_BUILDER_URL . 'public/css/builder-frontend.css',
            array(),
            SHA_BUILDER_VERSION . '.' . filemtime(SHA_BUILDER_PATH . 'public/css/builder-frontend.css')
        );

        wp_enqueue_script(
            'sha-builder-frontend-builder',
            SHA_BUILDER_URL . 'public/js/builder-frontend.js',
            array('jquery'),
            SHA_BUILDER_VERSION . '.' . filemtime(SHA_BUILDER_PATH . 'public/js/builder-frontend.js'),
            true
        );

        wp_localize_script('sha-builder-frontend-builder', 'shaBuilderFrontend', array(
            'ajaxUrl'  => admin_url('admin-ajax.php'),
            'nonce'    => wp_create_nonce('sha_builder_nonce'),
            'postId'   => get_the_ID(),
        ));
    }

    public function render_sections_json() {
        if (!self::$builder_mode) {
            return;
        }
        $post_id = get_the_ID();
        if (!$post_id) {
            return;
        }

        $frontend = sha_builder()->get_frontend();
        $data = $frontend->get_data($post_id);
        if (!$data || empty($data['sections'])) {
            return;
        }

        $sections = array();
        foreach ($data['sections'] as $sec) {
            if (is_array($sec)) {
                $sections[] = array(
                    'id'    => isset($sec['id']) ? $sec['id'] : '',
                    'label' => isset($sec['label']) ? $sec['label'] : 'Section',
                    'html'  => isset($sec['html']) ? $sec['html'] : '',
                    'css'   => isset($sec['css']) ? $sec['css'] : '',
                    'js'    => isset($sec['js']) ? $sec['js'] : '',
                );
            }
        }

        echo '<script id="sha-frontend-sections-data" type="application/json">'
            . wp_json_encode(array(
                'sections' => $sections,
                'globalCss' => $data['global_css'] ?? '',
                'globalJs' => $data['global_js'] ?? '',
                'element_overrides' => isset($data['element_overrides']) ? $data['element_overrides'] : new stdClass(),
            ))
            . '</script>';
    }

    public function add_builder_attributes($attrs, $section_id) {
        if (self::$builder_mode && $section_id) {
            $attrs['data-section-id'] = esc_attr($section_id);
        }
        return $attrs;
    }

    public function ajax_save_section() {
        check_ajax_referer('sha_builder_nonce', 'nonce');

        $post_id = isset($_POST['post_id']) ? intval($_POST['post_id']) : 0;
        if (!$post_id) {
            wp_send_json_error(array('message' => 'Invalid post ID.'));
        }
        if (!is_user_logged_in() || !current_user_can('edit_post', $post_id)) {
            wp_send_json_error(array('message' => 'Permission denied.'));
        }

        $sections_json = isset($_POST['sections_json']) ? wp_unslash($_POST['sections_json']) : '';
        $sections = json_decode($sections_json, true);
        if (!is_array($sections)) {
            wp_send_json_error(array('message' => 'Invalid sections data.'));
        }

        $ajax = sha_builder()->get_ajax();
        if (!$ajax) {
            $ajax = new Sha_Builder_Ajax();
        }

        $sections = $ajax->sanitize_sections($sections);
        $global_css = isset($_POST['global_css']) ? $ajax->sanitize_code_input(wp_unslash($_POST['global_css']), 262144) : '';
        $global_js  = isset($_POST['global_js'])  ? $ajax->sanitize_code_input(wp_unslash($_POST['global_js']), 262144) : '';
        $element_overrides = isset($_POST['element_overrides']) ? json_decode(wp_unslash($_POST['element_overrides']), true) : array();
        if (!is_array($element_overrides)) $element_overrides = array();

        // Write section code to files, save mapping to DB
        $storage = new Sha_Builder_File_Storage();
        $mapping_sections = array();
        foreach ($sections as $sec) {
            $storage->write_section(
                $post_id,
                $sec['id'],
                $sec['html'],
                $sec['css'],
                $sec['js']
            );
            $mapping_sections[] = array(
                'id'    => $sec['id'],
                'label' => $sec['label'],
            );
        }

        update_post_meta($post_id, '_sha_builder_data', array(
            'version'   => 3,
            'sections'  => $mapping_sections,
            'global_css' => $global_css,
            'global_js'  => $global_js,
            'element_overrides' => $element_overrides,
            'saved_at'  => current_time('mysql'),
        ));

        $assembled = $ajax->assemble_sections($sections);
        $executor = Sha_Builder_PHP_Executor::instance();
        $executor->flush_post_cache($post_id);
        $executor->generate_cache($post_id, $assembled['html']);

        wp_send_json_success(array('message' => 'Section saved.'));
    }

    public function ajax_get_section() {
        check_ajax_referer('sha_builder_nonce', 'nonce');

        $post_id = isset($_POST['post_id']) ? intval($_POST['post_id']) : 0;
        $section_id = isset($_POST['section_id']) ? sanitize_text_field(wp_unslash($_POST['section_id'])) : '';
        if (!is_user_logged_in() || !current_user_can('edit_post', $post_id)) {
            wp_send_json_error(array('message' => 'Permission denied.'));
        }

        if (!$post_id || !$section_id) {
            wp_send_json_error(array('message' => 'Missing parameters.'));
        }

        $raw = get_post_meta($post_id, '_sha_builder_data', true);
        if (!is_array($raw)) {
            wp_send_json_error(array('message' => 'No data found.'));
        }

        $ajax = sha_builder()->get_ajax();
        if ($ajax && method_exists($ajax, 'migrate_to_sections')) {
            $data = $ajax->migrate_to_sections($raw, $post_id);
        } else {
            $data = $raw;
        }

        if (empty($data['sections']) || !is_array($data['sections'])) {
            wp_send_json_error(array('message' => 'No sections.'));
        }

        foreach ($data['sections'] as $sec) {
            if (is_array($sec) && isset($sec['id']) && $sec['id'] === $section_id) {
                $response_sec = $sec;
                unset($response_sec['_html_file']);
                wp_send_json_success(array(
                    'section' => $response_sec,
                    'globalCss' => $data['global_css'] ?? '',
                    'globalJs'  => $data['global_js'] ?? '',
                ));
            }
        }

        wp_send_json_error(array('message' => 'Section not found.'));
    }
}
