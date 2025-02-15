<script>
    import {Button, Nav, Navbar, NavbarBrand, NavItem} from "sveltestrap";
    import { goto } from '@roxi/routify';
    $goto

    function handleLogin() {
        $goto('/login');
    }
</script>


<Navbar color="light" light expand="md">
    <Nav class="navbar w-100 d-flex justify-content-between mx-5">
        <NavbarBrand href="/">DMART</NavbarBrand>
        <NavItem>
            <Button color="primary" onclick={handleLogin}>Login</Button>
        </NavItem>
    </Nav>
</Navbar>

<slot />
