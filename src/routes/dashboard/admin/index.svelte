<script lang="ts">
    import { Container, Row, Col, Nav, NavItem, Collapse, NavbarToggler, Card, CardBody, CardTitle, CardText } from 'sveltestrap';
    import {user} from "@/stores/user";
    import { _ } from '@/i18n';

    let isOpen = $state(true);

    function toggle() {
        isOpen = !isOpen;
    }
</script>

<Container>
    <h1>{$_('Welcome')} {$user.localized_displayname}</h1>
</Container>
