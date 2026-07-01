<?php
if (!defined('ABSPATH')) {
    exit;
}

$frontend = sha_builder()->get_frontend();
$frontend->render_custom_header();
?>
<div class="sha-builder-full-width">
    <?php
    while (have_posts()) {
        the_post();
        the_content();
    }
    ?>
</div>
<?php
$frontend->render_custom_footer();
