<?php
if (!defined('ABSPATH')) {
    exit;
}

$frontend = sha_builder()->get_frontend();
$frontend->render_custom_header();
?>
<main id="sha-builder-main" class="sha-builder-page-content">
    <?php
    while (have_posts()) {
        the_post();
        the_content();
    }
    ?>
</main>
<?php
$frontend->render_custom_footer();
