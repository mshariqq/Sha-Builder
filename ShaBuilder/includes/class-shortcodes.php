<?php
if (!defined('ABSPATH')) {
    exit;
}

class Sha_Builder_Shortcodes {

    public function __construct() {
        add_shortcode('sha_field', array($this, 'shortcode_field'));
        add_shortcode('sha_meta', array($this, 'shortcode_meta'));
        add_shortcode('sha_terms', array($this, 'shortcode_terms'));
    }

    private function get_post_id() {
        if (Sha_Builder_Frontend::$original_post_id) {
            return Sha_Builder_Frontend::$original_post_id;
        }
        return get_the_ID();
    }

    public function shortcode_field($atts) {
        $atts = shortcode_atts(array(
            'name'    => 'post_title',
            'size'    => 'large',
            'format'  => get_option('date_format'),
            'class'   => '',
            'fallback' => '',
        ), $atts);

        $post_id = $this->get_post_id();
        if (!$post_id) {
            return $atts['fallback'];
        }

        $post = get_post($post_id);
        if (!$post) {
            return $atts['fallback'];
        }

        switch ($atts['name']) {
            case 'post_title':
                return esc_html(get_the_title($post_id));

            case 'post_content':
                $content = get_post_field('post_content', $post_id);
                return apply_filters('the_content', $content);

            case 'post_excerpt':
                $excerpt = get_post_field('post_excerpt', $post_id);
                if (empty($excerpt)) {
                    $excerpt = wp_trim_words(get_post_field('post_content', $post_id), 55);
                }
                return esc_html($excerpt);

            case 'permalink':
                return esc_url(get_permalink($post_id));

            case 'post_date':
                return esc_html(get_the_date($atts['format'], $post_id));

            case 'modified_date':
                return esc_html(get_the_modified_date($atts['format'], $post_id));

            case 'author':
                $author_id = get_post_field('post_author', $post_id);
                return esc_html(get_the_author_meta('display_name', $author_id));

            case 'comment_count':
                return esc_html(get_comments_number($post_id));

            case 'featured_image':
                if (has_post_thumbnail($post_id)) {
                    return get_the_post_thumbnail($post_id, $atts['size'], array('class' => $atts['class']));
                }
                return $atts['fallback'];

            case 'featured_image_url':
                if (has_post_thumbnail($post_id)) {
                    $src = wp_get_attachment_image_src(get_post_thumbnail_id($post_id), $atts['size']);
                    return $src ? esc_url($src[0]) : $atts['fallback'];
                }
                return $atts['fallback'];

            case 'post_id':
                return intval($post_id);

            case 'post_type':
                return esc_html(get_post_type($post_id));

            case 'slug':
                return esc_html($post->post_name);

            case 'post_status':
                return esc_html(get_post_status($post_id));

            default:
                return $atts['fallback'];
        }
    }

    public function shortcode_meta($atts) {
        $atts = shortcode_atts(array(
            'key'      => '',
            'fallback' => '',
        ), $atts);

        $post_id = $this->get_post_id();
        if (!$post_id || empty($atts['key'])) {
            return $atts['fallback'];
        }

        $value = get_post_meta($post_id, $atts['key'], true);
        if (empty($value)) {
            return $atts['fallback'];
        }

        return esc_html($value);
    }

    public function shortcode_terms($atts) {
        $atts = shortcode_atts(array(
            'taxonomy'  => 'category',
            'separator' => ', ',
            'link'      => false,
        ), $atts);

        $post_id = $this->get_post_id();
        if (!$post_id) {
            return '';
        }

        $terms = get_the_terms($post_id, $atts['taxonomy']);
        if (empty($terms) || is_wp_error($terms)) {
            return '';
        }

        $output = array();
        foreach ($terms as $term) {
            if (filter_var($atts['link'], FILTER_VALIDATE_BOOLEAN)) {
                $output[] = '<a href="' . esc_url(get_term_link($term)) . '">' . esc_html($term->name) . '</a>';
            } else {
                $output[] = esc_html($term->name);
            }
        }

        return implode($atts['separator'], $output);
    }
}
