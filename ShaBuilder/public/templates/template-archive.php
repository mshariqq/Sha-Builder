<?php
if (!defined('ABSPATH')) {
    exit;
}

$frontend = sha_builder()->get_frontend();
$template_id = Sha_Builder_Frontend::$matched_archive_template_id;
$data = $frontend->get_data($template_id);

// Set up first post from the main query so get_the_ID(), $product, and
// other post-related globals / template tags are available inside section PHP.
global $wp_query, $post;
$first_post = !empty($wp_query->posts) ? $wp_query->posts[0] : null;
if ($first_post) {
    $post = $first_post;
    setup_postdata($post);
    Sha_Builder_Frontend::$original_post_id = $post->ID;

    if (class_exists('WooCommerce') && 'product' === $post->post_type) {
        global $product;
        $product = wc_get_product($post->ID);
    }
} else {
    Sha_Builder_Frontend::$original_post_id = 0;
}

$frontend->render_custom_header();
?>
<main id="sha-builder-archive-main" class="sha-builder-archive-content">
    <?php
    if ($data && !empty($data['sections'])) :
        $executor = Sha_Builder_PHP_Executor::instance();
        foreach ($data['sections'] as $sec) :
            if (!is_array($sec) || empty($sec['html'])) continue;
            if (!$frontend->should_render_section($sec)) continue;
            $sec_id = isset($sec['id']) ? esc_attr($sec['id']) : '';
            $html_file = isset($sec['_html_file']) ? $sec['_html_file'] : null;
            $sec_html = $executor->execute_html($template_id, $sec_id, $sec['html'], $html_file);
            $sec_html = do_shortcode($sec_html);
            ?>
            <div id="sha-section-<?php echo esc_attr($sec_id); ?>" class="sha-builder-section">
                <?php echo $sec_html; ?>
            </div>
        <?php endforeach;
    endif; ?>
</main>
<?php
$frontend->render_custom_footer();
