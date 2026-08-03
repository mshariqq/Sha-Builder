<?php
if (!defined('ABSPATH')) {
    exit;
}

class Sha_Builder_Ajax {

    private const MAX_HTML_LENGTH   = 5242880;
    private const MAX_CSS_LENGTH    = 262144;
    private const MAX_JS_LENGTH     = 262144;
    private const MAX_POST_BYTES    = 10485760;
    private const DATA_VERSION      = 3;
    private const MAX_SECTIONS      = 200;
    private const MAX_LABEL_LENGTH  = 255;

    public function __construct() {
        add_action('wp_ajax_sha_builder_save', array($this, 'save_builder_data'));
        add_action('wp_ajax_sha_builder_load', array($this, 'load_builder_data'));
        add_action('wp_ajax_sha_builder_execute_php', array($this, 'execute_php_for_preview'));
        add_action('wp_ajax_sha_builder_get_preview_assets', array($this, 'get_preview_assets'));
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

    /**
     * Migrate any format to v3 with file-backed section code.
     * Returns full section data with code merged from files.
     */
    public function migrate_to_sections($data, $post_id = 0) {
        if (!is_array($data)) {
            return $this->default_data();
        }
        $version = isset($data['version']) ? intval($data['version']) : 1;

        if ($version < 2) {
            $data = $this->migrate_v1_to_v2($data);
        }
        if ($version < 3) {
            $data = $this->migrate_to_v3($data, $post_id);
        }

        if (isset($data['version']) && intval($data['version']) === 3) {
            return $this->load_v3_data($data, $post_id);
        }

        return $data;
    }

    public function load_v3_data($mapping, $post_id) {
        $storage = new Sha_Builder_File_Storage();
        $sections = array();
        if (!empty($mapping['sections']) && is_array($mapping['sections'])) {
            foreach ($mapping['sections'] as $sec) {
                $file_data = $storage->read_section($post_id, $sec['id']);
                $sections[] = array(
                    'id'    => $sec['id'],
                    'label' => isset($sec['label']) ? $sec['label'] : __('Section', 'sha-builder'),
                    'html'  => $file_data['html'],
                    'css'   => $file_data['css'],
                    'js'    => $file_data['js'],
                    '_html_file' => $storage->get_html_path($post_id, $sec['id']),
                );
            }
        }
        return array(
            'version'    => self::DATA_VERSION,
            'sections'   => $sections,
            'global_css' => isset($mapping['global_css']) ? $mapping['global_css'] : '',
            'global_js'  => isset($mapping['global_js'])  ? $mapping['global_js']  : '',
            'saved_at'   => isset($mapping['saved_at'])   ? $mapping['saved_at']   : current_time('mysql'),
        );
    }

    public function migrate_v1_to_v2($data) {
        return array(
            'version'   => 2,
            'sections'  => array(
                array(
                    'id'    => 'sec_' . uniqid(),
                    'label' => __('Section', 'sha-builder'),
                    'html'  => isset($data['html']) ? $data['html'] : '',
                    'css'   => '',
                    'js'    => '',
                ),
            ),
            'global_css' => isset($data['css']) ? $data['css'] : '',
            'global_js'  => isset($data['js'])  ? $data['js']  : '',
            'saved_at'   => isset($data['saved_at']) ? $data['saved_at'] : current_time('mysql'),
        );
    }

    public function migrate_to_v3($data, $post_id) {
        if (!$post_id) {
            return $data;
        }
        $storage = new Sha_Builder_File_Storage();
        if (!empty($data['sections']) && is_array($data['sections'])) {
            foreach ($data['sections'] as $sec) {
                $storage->write_section(
                    $post_id,
                    $sec['id'],
                    isset($sec['html']) ? $sec['html'] : '',
                    isset($sec['css'])  ? $sec['css']  : '',
                    isset($sec['js'])   ? $sec['js']   : ''
                );
            }
        }
        $mapping = array(
            'version'   => self::DATA_VERSION,
            'sections'  => array(),
            'global_css' => isset($data['global_css']) ? $data['global_css'] : '',
            'global_js'  => isset($data['global_js'])  ? $data['global_js']  : '',
            'saved_at'   => isset($data['saved_at'])   ? $data['saved_at']   : current_time('mysql'),
        );
        if (!empty($data['sections']) && is_array($data['sections'])) {
            foreach ($data['sections'] as $sec) {
                $mapping['sections'][] = array(
                    'id'    => $sec['id'],
                    'label' => isset($sec['label']) ? $sec['label'] : __('Section', 'sha-builder'),
                );
            }
        }
        update_post_meta($post_id, '_sha_builder_data', $mapping);
        return $this->load_v3_data($mapping, $post_id);
    }

    public function default_data() {
        return array(
            'version'   => self::DATA_VERSION,
            'sections'  => array(
                array(
                    'id'    => 'sec_' . uniqid(),
                    'label' => __('Section', 'sha-builder'),
                    'html'  => '',
                    'css'   => '',
                    'js'    => '',
                ),
            ),
            'global_css' => '',
            'global_js'  => '',
            'saved_at'   => current_time('mysql'),
        );
    }

    /**
     * Assemble all section HTML+CSS+JS into single strings for cache/execution.
     */
    public function assemble_sections($sections) {
        $html = '';
        $css  = '';
        $js   = '';
        if (is_array($sections)) {
            foreach ($sections as $sec) {
                if (is_array($sec)) {
                    $html .= (isset($sec['html']) ? $sec['html'] : '') . "\n";
                    $css  .= (isset($sec['css'])  ? $sec['css']  : '') . "\n";
                    $js   .= (isset($sec['js'])   ? $sec['js']   : '') . "\n";
                }
            }
        }
        return array('html' => trim($html), 'css' => trim($css), 'js' => trim($js));
    }

    public function sanitize_sections($raw_sections) {
        if (!is_array($raw_sections)) {
            return array();
        }
        $sections = array();
        $count = 0;
        foreach ($raw_sections as $raw) {
            if ($count >= self::MAX_SECTIONS) {
                break;
            }
            if (!is_array($raw)) {
                continue;
            }
            $sections[] = array(
                'id'    => isset($raw['id']) ? substr(preg_replace('/[^a-zA-Z0-9_\-]/', '', $raw['id']), 0, 64) : 'sec_' . uniqid(),
                'label' => isset($raw['label']) ? substr(sanitize_text_field($raw['label']), 0, self::MAX_LABEL_LENGTH) : __('Section', 'sha-builder'),
                'html'  => isset($raw['html']) ? $this->sanitize_code_input($raw['html'], self::MAX_HTML_LENGTH) : '',
                'css'   => isset($raw['css'])  ? $this->sanitize_code_input($raw['css'], self::MAX_CSS_LENGTH) : '',
                'js'    => isset($raw['js'])   ? $this->sanitize_code_input($raw['js'], self::MAX_JS_LENGTH) : '',
            );
            $count++;
        }
        return $sections;
    }

    public function save_builder_data() {
        while (ob_get_level()) {
            ob_end_clean();
        }
        ob_start();

        $this->verify_request();

        $content_length = isset($_SERVER['CONTENT_LENGTH']) ? intval($_SERVER['CONTENT_LENGTH']) : 0;
        if ($content_length > self::MAX_POST_BYTES) {
            ob_end_clean();
            wp_send_json_error(array(
                'message' => sprintf(
                    __('POST data too large (%s bytes). Maximum allowed: %s bytes.', 'sha-builder'),
                    number_format($content_length),
                    number_format(self::MAX_POST_BYTES)
                ),
            ));
        }

        $post_id = isset($_POST['post_id']) ? intval($_POST['post_id']) : 0;
        if (!$post_id) {
            ob_end_clean();
            wp_send_json_error(array('message' => __('Invalid post ID.', 'sha-builder')));
        }

        $this->validate_post($post_id);

        // Parse sections from POST
        $raw_sections = array();
        if (isset($_POST['sections_json'])) {
            // New format: JSON-encoded sections array from FormData
            $decoded = json_decode(wp_unslash($_POST['sections_json']), true);
            if (is_array($decoded)) {
                $raw_sections = $decoded;
            }
        } elseif (isset($_POST['sections']) && is_array($_POST['sections'])) {
            // Alternative: sections array posted directly
            $raw_sections = $_POST['sections'];
        } elseif (isset($_POST['html'])) {
            // Backward compat: single html/css/js fields
            $raw_sections = array(
                array(
                    'id'    => 'sec_' . uniqid(),
                    'label' => __('Section', 'sha-builder'),
                    'html'  => $_POST['html'],
                    'css'   => '',
                    'js'    => '',
                ),
            );
        }

        $sections  = $this->sanitize_sections($raw_sections);
        $global_css = isset($_POST['global_css']) ? $this->sanitize_code_input($_POST['global_css'], self::MAX_CSS_LENGTH) : '';
        $global_js  = isset($_POST['global_js'])  ? $this->sanitize_code_input($_POST['global_js'], self::MAX_JS_LENGTH) : '';

        // Write each section's code to files
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

        // Save only mapping to DB
        $data = array(
            'version'   => self::DATA_VERSION,
            'sections'  => $mapping_sections,
            'global_css' => $global_css,
            'global_js'  => $global_js,
            'saved_at'  => current_time('mysql'),
        );

        $assembled = $this->assemble_sections($sections);
        error_log('[SHA BUILDER] Saving post_id=' . $post_id . ' sections=' . count($sections) . ' html_len=' . strlen($assembled['html']) . ' css_len=' . strlen($assembled['css']) . ' js_len=' . strlen($assembled['js']));

        $result = update_post_meta($post_id, '_sha_builder_data', $data);

        if (false === $result) {
            error_log('[SHA BUILDER] update_post_meta returned false for post_id=' . $post_id);
        }

        // Flush per-section caches and generate cache for the assembled HTML (PHP execution)
        $executor = Sha_Builder_PHP_Executor::instance();
        $executor->flush_post_cache($post_id);
        $executor->generate_cache($post_id, $assembled['html']);

        ob_end_clean();
        wp_send_json_success(array(
            'message' => __('Page saved successfully.', 'sha-builder'),
        ));
    }

    public function sanitize_code_input($input, $max_length) {
        $input = wp_unslash($input);
        $input = wp_check_invalid_utf8($input, true);
        if (strlen($input) > $max_length) {
            $input = substr($input, 0, $max_length);
        }
        return $input;
    }
}
