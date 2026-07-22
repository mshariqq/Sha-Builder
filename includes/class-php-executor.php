<?php
if (!defined('ABSPATH')) {
    exit;
}

class Sha_Builder_PHP_Executor {

    private static $instance = null;

    public static function instance() {
        if (is_null(self::$instance)) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function has_php_code($html) {
        if (empty($html) || !is_string($html)) {
            return false;
        }
        return (bool) preg_match('/<\?php|<\?=|<\?[^x]/', $html);
    }

    public function get_cache_dir() {
        $upload_dir = wp_upload_dir();
        $dir = trailingslashit($upload_dir['basedir']) . 'sha-builder/cache';
        if (!file_exists($dir)) {
            wp_mkdir_p($dir);
            $this->write_security_files($dir);
        }
        return trailingslashit($dir);
    }

    public function get_cache_path($post_id, $section_id = '') {
        $key = $section_id ? intval($post_id) . '_' . sanitize_key($section_id) : intval($post_id);
        return $this->get_cache_dir() . $key . '.php';
    }

    public function get_cache_url($post_id, $section_id = '') {
        $upload_dir = wp_upload_dir();
        $key = $section_id ? intval($post_id) . '_' . sanitize_key($section_id) : intval($post_id);
        return trailingslashit($upload_dir['baseurl']) . 'sha-builder/cache/' . $key . '.php';
    }

    public function generate_cache($post_id, $html, $section_id = '') {
        if (!$this->has_php_code($html)) {
            $this->flush_cache($post_id, $section_id);
            return $html;
        }

        $executed = $this->execute_php($html);
        $cache_path = $this->get_cache_path($post_id, $section_id);

        $dir = dirname($cache_path);
        if (!file_exists($dir)) {
            wp_mkdir_p($dir);
            $this->write_security_files($dir);
        }

        $written = file_put_contents($cache_path, $executed);
        if ($written === false) {
            error_log('[SHA BUILDER] Failed to write cache file: ' . $cache_path);
            return $executed;
        }

        error_log('[SHA BUILDER] Cache generated for post_id=' . $post_id . ' section=' . ($section_id ?: 'full') . ' size=' . $written);
        return $executed;
    }

    public function load_from_cache($post_id, $section_id = '') {
        $cache_path = $this->get_cache_path($post_id, $section_id);
        if (!file_exists($cache_path)) {
            return false;
        }
        return file_get_contents($cache_path);
    }

    public function execute_html($post_id, $section_id, $html = null, $file_path = null) {
        if ($file_path && file_exists($file_path)) {
            $raw = file_get_contents($file_path);
            $html = $raw !== false ? $raw : $html;
        }
        if ($html === null || !$this->has_php_code($html)) {
            return do_shortcode($html ?? '');
        }

        $cached = $this->load_from_cache($post_id, $section_id);
        if ($cached !== false) {
            return do_shortcode($cached);
        }

        return do_shortcode($this->generate_cache($post_id, $html, $section_id));
    }

    public function flush_cache($post_id, $section_id = '') {
        $cache_path = $this->get_cache_path($post_id, $section_id);
        if (file_exists($cache_path)) {
            @unlink($cache_path);
            error_log('[SHA BUILDER] Cache flushed: ' . basename($cache_path));
        }
    }

    public function flush_post_cache($post_id) {
        $cache_dir = $this->get_cache_dir();
        $files = glob($cache_dir . intval($post_id) . '_*.php');
        if (is_array($files)) {
            foreach ($files as $file) {
                @unlink($file);
            }
        }
        $this->flush_cache($post_id);
    }

    public function execute_php($html) {
        if (!$this->has_php_code($html)) {
            return $html;
        }

        $capability = apply_filters('sha_builder_php_execution_capability', 'manage_options');
        if (!current_user_can($capability)) {
            return $html;
        }

        ob_start();
        try {
            eval('?>' . $html);
            $output = ob_get_clean();
        } catch (\Exception $e) {
            while (ob_get_level()) { ob_end_clean(); }
            error_log('[SHA BUILDER] PHP execution error (Exception): ' . $e->getMessage());
            return $html;
        } catch (\ParseError $e) {
            while (ob_get_level()) { ob_end_clean(); }
            error_log('[SHA BUILDER] PHP execution error (ParseError): ' . $e->getMessage());
            return $html;
        } catch (\Error $e) {
            while (ob_get_level()) { ob_end_clean(); }
            error_log('[SHA BUILDER] PHP execution error (Error): ' . $e->getMessage());
            return $html;
        }

        if ($output === false || $output === null) {
            error_log('[SHA BUILDER] PHP execution returned no output');
            return $html;
        }

        return $output;
    }

    public function flush_all_cache() {
        $cache_dir = $this->get_cache_dir();
        if (!file_exists($cache_dir)) {
            return;
        }

        $files = glob($cache_dir . '*.php');
        if (is_array($files)) {
            foreach ($files as $file) {
                @unlink($file);
            }
        }

        error_log('[SHA BUILDER] All cache flushed');
    }

    private function write_security_files($dir) {
        $htaccess = $dir . '.htaccess';
        if (!file_exists($htaccess)) {
            file_put_contents($htaccess, "Deny from all\n");
        }

        $webconfig = $dir . 'web.config';
        if (!file_exists($webconfig)) {
            file_put_contents($webconfig, '<?xml version="1.0" encoding="UTF-8"?>' . "\n"
                . '<configuration>' . "\n"
                . '<system.webServer>' . "\n"
                . '<security>' . "\n"
                . '<requestFiltering>' . "\n"
                . '<fileExtensions>' . "\n"
                . '<add fileExtension=".php" allowed="false" />' . "\n"
                . '</fileExtensions>' . "\n"
                . '</requestFiltering>' . "\n"
                . '</security>' . "\n"
                . '</system.webServer>' . "\n"
                . '</configuration>'
            );
        }

        $index = $dir . 'index.php';
        if (!file_exists($index)) {
            file_put_contents($index, '<?php if (!defined("ABSPATH")) exit; ?>' . "\n");
        }
    }
}
