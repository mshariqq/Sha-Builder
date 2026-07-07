<?php
if (!defined('ABSPATH')) {
    exit;
}

$frontend  = sha_builder()->get_frontend();
$footer_id = $frontend->get_effective_footer_id();
$data      = array();

if ($footer_id) {
    $data = get_post_meta($footer_id, '_sha_builder_data', true);
}

if (!is_array($data)) {
    $data = array('html' => '', 'css' => '', 'js' => '');
}

if (!empty($data['html'])) {
    $executor = Sha_Builder_PHP_Executor::instance();
    $html = $executor->execute_html($footer_id, $data['html']);
    echo '<div id="sha-builder-footer" class="sha-builder-footer">' . $html . '</div>';
}

if (!empty($data['js'])) :
?>
<script id="sha-builder-footer-js">
<?php echo $data['js']; ?>
</script>
<?php endif; ?>
<?php wp_footer(); ?>
</body>
</html>
