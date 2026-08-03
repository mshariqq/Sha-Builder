<?php
if (!defined('ABSPATH')) {
    exit;
}

class Sha_Builder_File_Storage {

    private function get_base_dir() {
        $upload = wp_upload_dir();
        $dir = trailingslashit($upload['basedir']) . 'sha-builder';
        wp_mkdir_p($dir);
        return trailingslashit($dir);
    }

    public function get_sections_dir($post_id) {
        $dir = $this->get_base_dir() . 'sections/' . intval($post_id);
        wp_mkdir_p($dir);
        $this->write_security_files($dir);
        return trailingslashit($dir);
    }

    public function read_section($post_id, $section_id) {
        $dir = $this->get_sections_dir($post_id);
        $html_file = $dir . $section_id . '.html';
        $css_file  = $dir . $section_id . '.css';
        $js_file   = $dir . $section_id . '.js';
        return array(
            'html' => file_exists($html_file) ? file_get_contents($html_file) : '',
            'css'  => file_exists($css_file)  ? file_get_contents($css_file)  : '',
            'js'   => file_exists($js_file)   ? file_get_contents($js_file)   : '',
        );
    }

    public function write_section($post_id, $section_id, $html, $css, $js) {
        $dir = $this->get_sections_dir($post_id);
        $written = 0;
        if (false !== file_put_contents($dir . $section_id . '.html', $html)) $written++;
        if (false !== file_put_contents($dir . $section_id . '.css',  $css))  $written++;
        if (false !== file_put_contents($dir . $section_id . '.js',   $js))   $written++;
        if ($written < 3) {
            error_log('[SHA BUILDER] File write issue for post_id=' . $post_id . ' section=' . $section_id . ' written=' . $written . '/3');
        }
    }

    public function delete_section($post_id, $section_id) {
        $dir = $this->get_sections_dir($post_id);
        @unlink($dir . $section_id . '.html');
        @unlink($dir . $section_id . '.css');
        @unlink($dir . $section_id . '.js');
    }

    public function delete_post_sections($post_id) {
        $dir = $this->get_base_dir() . 'sections/' . intval($post_id);
        if (is_dir($dir)) {
            $files = glob($dir . '/*.{html,css,js}', GLOB_BRACE);
            if (is_array($files)) {
                foreach ($files as $f) {
                    @unlink($f);
                }
            }
            @rmdir($dir);
        }
    }

    public function get_html_path($post_id, $section_id) {
        return $this->get_sections_dir($post_id) . $section_id . '.html';
    }

    private function write_security_files($dir) {
        $htaccess = $dir . '/.htaccess';
        if (!file_exists($htaccess)) {
            file_put_contents($htaccess, "Deny from all\n");
        }
        $index = $dir . '/index.php';
        if (!file_exists($index)) {
            file_put_contents($index, "<?php if (!defined('ABSPATH')) exit; ?>\n");
        }
    }
}
