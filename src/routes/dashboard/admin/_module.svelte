<script lang="ts">
    import { Container, Row, Col, Nav, NavItem, Collapse, NavbarToggler } from 'sveltestrap';

    let isOpen = $state(true);

    function toggle() {
        isOpen = !isOpen;
    }
</script>

<Container fluid={true} class=" h-100 position-relative p-0">
    <Row class="h-100" noGutters>
        <Col sm="2" class="h-100 bg-light border-end border-light px-1">
            <div class="sidebar" class:collapsed={isOpen}>
                <NavbarToggler on:click={toggle} />
                <Collapse isOpen={isOpen}>
                    <Nav vertical>
                        <NavItem>
                            <a href="/dashboard/admin/users" class="nav-link">Users</a>
                        </NavItem>
                        <NavItem>
                            <a href="/dashboard/admin/posts" class="nav-link">Posts</a>
                        </NavItem>
                    </Nav>
                </Collapse>
            </div>
        </Col>
        <Col sm="10" class="border-end border-light px-1 overflow-auto">
            <slot/>
        </Col>
    </Row>
</Container>